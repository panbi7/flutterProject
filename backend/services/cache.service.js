import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { CACHE_TTL } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('CACHE_SERVICE');

// 캐시 디렉토리 경로
const CACHE_BASE_DIR = path.join(__dirname, '../../data/cache');
const PACKAGES_CACHE_DIR = path.join(CACHE_BASE_DIR, 'packages');
const GUIDES_CACHE_DIR = path.join(CACHE_BASE_DIR, 'guides');

// 메모리 캐시 (서버리스 환경에서는 제한적)
const memoryCache = new Map();

/**
 * 캐시 디렉토리 초기화
 */
async function ensureCacheDirectories() {
    try {
        await fs.mkdir(PACKAGES_CACHE_DIR, { recursive: true });
        await fs.mkdir(GUIDES_CACHE_DIR, { recursive: true });
        logger.debug('Cache directories ensured');
    } catch (error) {
        logger.error('Failed to create cache directories', { error: error.message });
    }
}

/**
 * 캐시 키 생성
 */
function getCacheKey(type, identifier) {
    return `${type}:${identifier}`;
}

/**
 * 파일 경로 생성
 */
function getCacheFilePath(type, identifier) {
    const dir = type === 'package' ? PACKAGES_CACHE_DIR : GUIDES_CACHE_DIR;
    return path.join(dir, `${identifier}.json`);
}

/**
 * 메모리 캐시에서 가져오기
 */
function getFromMemory(key) {
    const cached = memoryCache.get(key);
    if (!cached) return null;

    const { data, timestamp, ttl } = cached;
    const now = Date.now();

    // TTL 체크
    if (ttl !== Infinity && now - timestamp > ttl) {
        memoryCache.delete(key);
        return null;
    }

    logger.debug('Memory cache hit', { key });
    return data;
}

/**
 * 메모리 캐시에 저장
 */
function setToMemory(key, data, ttl) {
    memoryCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
    });
    logger.debug('Memory cache set', { key });
}

/**
 * 파일 캐시에서 가져오기
 */
async function getFromFile(filePath, ttl) {
    try {
        const stats = await fs.stat(filePath);
        const now = Date.now();

        // TTL 체크
        if (ttl !== Infinity && now - stats.mtimeMs > ttl) {
            logger.debug('File cache expired', { filePath });
            await fs.unlink(filePath).catch(() => { });
            return null;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        logger.debug('File cache hit', { filePath });
        return data;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn('Failed to read cache file', { filePath, error: error.message });
        }
        return null;
    }
}

/**
 * 파일 캐시에 저장
 */
async function setToFile(filePath, data) {
    try {
        await ensureCacheDirectories();
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        logger.debug('File cache set', { filePath });
    } catch (error) {
        logger.error('Failed to write cache file', { filePath, error: error.message });
    }
}

/**
 * 패키지 정보 캐시 가져오기
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
export async function getCachedPackageInfo(packageName) {
    const key = getCacheKey('package', packageName);

    // 1. 메모리 캐시 확인
    const memCached = getFromMemory(key);
    if (memCached) return memCached;

    // 2. 파일 캐시 확인
    const filePath = getCacheFilePath('package', packageName);
    const fileCached = await getFromFile(filePath, CACHE_TTL.PACKAGE_INFO);

    if (fileCached) {
        // 메모리 캐시에도 저장
        setToMemory(key, fileCached, CACHE_TTL.PACKAGE_INFO);
        return fileCached;
    }

    logger.debug('Cache miss for package', { packageName });
    return null;
}

/**
 * 패키지 정보 캐시 저장
 * @param {string} packageName
 * @param {Object} data
 */
export async function setCachedPackageInfo(packageName, data) {
    const key = getCacheKey('package', packageName);
    const filePath = getCacheFilePath('package', packageName);

    // 메모리 + 파일 캐시 모두 저장
    setToMemory(key, data, CACHE_TTL.PACKAGE_INFO);
    await setToFile(filePath, data);

    logger.info('Package info cached', { packageName });
}

/**
 * 가이드 캐시 가져오기
 * @param {string} packageName
 * @param {string} version
 * @returns {Promise<Object|null>}
 */
export async function getCachedGuide(packageName, version) {
    const identifier = `${packageName}-${version}`;
    const key = getCacheKey('guide', identifier);

    // 1. 메모리 캐시 확인
    const memCached = getFromMemory(key);
    if (memCached) return memCached;

    // 2. 파일 캐시 확인 (가이드는 영구 캐싱)
    const filePath = getCacheFilePath('guide', identifier);
    const fileCached = await getFromFile(filePath, CACHE_TTL.GUIDE);

    if (fileCached) {
        // 메모리 캐시에도 저장
        setToMemory(key, fileCached, CACHE_TTL.GUIDE);
        return fileCached;
    }

    logger.debug('Cache miss for guide', { packageName, version });
    return null;
}

/**
 * 가이드 캐시 저장
 * @param {string} packageName
 * @param {string} version
 * @param {Object} data
 */
export async function setCachedGuide(packageName, version, data) {
    const identifier = `${packageName}-${version}`;
    const key = getCacheKey('guide', identifier);
    const filePath = getCacheFilePath('guide', identifier);

    // 메모리 + 파일 캐시 모두 저장
    setToMemory(key, data, CACHE_TTL.GUIDE);
    await setToFile(filePath, data);

    logger.info('Guide cached', { packageName, version });
}

/**
 * 캐시 무효화
 * @param {string} type - 'package' | 'guide'
 * @param {string} identifier
 */
export async function invalidateCache(type, identifier) {
    const key = getCacheKey(type, identifier);
    const filePath = getCacheFilePath(type, identifier);

    // 메모리 캐시 삭제
    memoryCache.delete(key);

    // 파일 캐시 삭제
    try {
        await fs.unlink(filePath);
        logger.info('Cache invalidated', { type, identifier });
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn('Failed to invalidate cache', { type, identifier, error: error.message });
        }
    }
}
