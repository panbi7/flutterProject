import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { isValidPackageName } from '../utils/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('PACKAGE_INDEX_SERVICE');

// 패키지 인덱스 파일 경로
const INDEX_FILE_PATH = path.join(__dirname, '../../data/index/package-names.json');

let packageIndex = null; // 메모리 캐시

/**
 * 패키지 인덱스 로드
 * @returns {Promise<Array<string>>}
 */
export async function loadPackageIndex() {
    if (packageIndex) {
        logger.debug('Package index loaded from memory');
        return packageIndex;
    }

    try {
        const content = await fs.readFile(INDEX_FILE_PATH, 'utf-8');
        packageIndex = JSON.parse(content);
        logger.info('Package index loaded from file', { count: packageIndex.length });
        return packageIndex;
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('Package index file not found, returning empty array');
            packageIndex = [];
            return packageIndex;
        }
        logger.error('Failed to load package index', { error: error.message });
        throw error;
    }
}

/**
 * 패키지 인덱스 저장
 * @param {Array<string>} packages
 */
export async function savePackageIndex(packages) {
    try {
        // 디렉토리 생성
        const dir = path.dirname(INDEX_FILE_PATH);
        await fs.mkdir(dir, { recursive: true });

        // 중복 제거 및 정렬
        const uniquePackages = [...new Set(packages)].sort();

        // 파일 저장
        await fs.writeFile(INDEX_FILE_PATH, JSON.stringify(uniquePackages, null, 2), 'utf-8');

        // 메모리 캐시 업데이트
        packageIndex = uniquePackages;

        logger.info('Package index saved', { count: uniquePackages.length });
    } catch (error) {
        logger.error('Failed to save package index', { error: error.message });
        throw error;
    }
}

/**
 * 패키지 검색 (로컬 인덱스)
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<string>>}
 */
export async function searchPackageIndex(query, limit = 10) {
    const index = await loadPackageIndex();
    const lowerQuery = query.toLowerCase();

    const results = index
        .filter((pkg) => pkg.toLowerCase().includes(lowerQuery))
        .slice(0, limit);

    logger.debug('Package index search', { query, resultCount: results.length });
    return results;
}

/**
 * 패키지 존재 여부 확인
 * @param {string} packageName
 * @returns {Promise<boolean>}
 */
export async function packageExists(packageName) {
    if (!isValidPackageName(packageName)) {
        return false;
    }

    const index = await loadPackageIndex();
    return index.includes(packageName);
}

/**
 * 패키지 인덱스에 추가
 * @param {string} packageName
 */
export async function addToPackageIndex(packageName) {
    if (!isValidPackageName(packageName)) {
        logger.warn('Invalid package name', { packageName });
        return;
    }

    const index = await loadPackageIndex();

    if (!index.includes(packageName)) {
        index.push(packageName);
        await savePackageIndex(index);
        logger.info('Package added to index', { packageName });
    }
}
