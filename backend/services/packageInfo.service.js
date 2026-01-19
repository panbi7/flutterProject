import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { fetchPackageInfo, fetchPackageScore } from '../adapters/pubdev.adapter.js';
import { scrapeExampleCode } from '../adapters/scraper.adapter.js';
import { getCachedPackageInfo, setCachedPackageInfo } from './cache.service.js';
import { isValidPackageName } from '../utils/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('PACKAGE_INFO_SERVICE');

// 로컬 데이터 디렉토리
const LOCAL_DATA_DIR = path.join(__dirname, '../../netlify/functions/data');
const LOCAL_PACKAGES_DIR = path.join(LOCAL_DATA_DIR, 'packages');
const LOCAL_EXAMPLES_DIR = path.join(LOCAL_DATA_DIR, 'examples');

/**
 * 로컬 큐레이션 데이터 로드 (있는 경우)
 */
async function loadLocalPackageData(packageName) {
    try {
        // packages 디렉토리에서 찾기
        const packagesPath = path.join(LOCAL_PACKAGES_DIR, `${packageName}.json`);
        try {
            const content = await fs.readFile(packagesPath, 'utf-8');
            const data = JSON.parse(content);
            logger.debug('Local package data loaded', { packageName, source: 'packages' });
            return data;
        } catch (error) {
            // examples 디렉토리에서 찾기
            const examplesPath = path.join(LOCAL_EXAMPLES_DIR, `${packageName}.json`);
            const content = await fs.readFile(examplesPath, 'utf-8');
            const data = JSON.parse(content);
            logger.debug('Local package data loaded', { packageName, source: 'examples' });
            return data;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn('Failed to load local package data', { packageName, error: error.message });
        }
        return null;
    }
}

/**
 * 패키지 상세 정보 수집 (온디맨드)
 * @param {string} packageName
 * @returns {Promise<Object>}
 */
export async function getPackageInfo(packageName) {
    if (!isValidPackageName(packageName)) {
        throw new Error(`Invalid package name: ${packageName}`);
    }

    logger.info('Fetching package info', { packageName });

    // 1. 캐시 확인
    const cached = await getCachedPackageInfo(packageName);
    if (cached) {
        logger.info('Package info from cache', { packageName });
        return cached;
    }

    // 2. pub.dev API + 스크래핑 + 로컬 데이터 병합
    const [pubInfo, scoreInfo, exampleCode, localData] = await Promise.all([
        fetchPackageInfo(packageName),
        fetchPackageScore(packageName),
        scrapeExampleCode(packageName),
        loadLocalPackageData(packageName),
    ]);

    if (!pubInfo) {
        throw new Error(`Package not found: ${packageName}`);
    }

    // 3. 데이터 병합 (로컬 데이터 우선)
    const mergedInfo = {
        id: packageName,
        name: packageName,
        version: pubInfo.version,
        description: localData?.description || pubInfo.description,
        homepage: pubInfo.homepage,
        repository: pubInfo.repository,
        published: pubInfo.published,
        score: scoreInfo || localData?.score || {},
        exampleCode: exampleCode || localData?.exampleCode || null,
        tags: localData?.tags || [],
        apiTags: localData?.apiTags || [],
        githubInfo: localData?.githubInfo || {},
        maintenance: localData?.maintenance || {},
        source: 'merged',
        fetchedAt: new Date().toISOString(),
    };

    // 4. 캐시에 저장
    await setCachedPackageInfo(packageName, mergedInfo);

    logger.info('Package info fetched and cached', { packageName, version: mergedInfo.version });
    return mergedInfo;
}

/**
 * 여러 패키지 정보 일괄 수집
 * @param {Array<string>} packageNames
 * @returns {Promise<Array<Object>>}
 */
export async function getMultiplePackageInfo(packageNames) {
    logger.info('Fetching multiple package info', { count: packageNames.length });

    const results = await Promise.allSettled(
        packageNames.map((name) => getPackageInfo(name))
    );

    const packages = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0) {
        logger.warn('Some packages failed to fetch', { failedCount: failed.length });
    }

    return packages;
}
