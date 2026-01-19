import { createLogger } from '../utils/logger.js';
import { retryWithBackoff, isRetryableError } from '../utils/retry.js';
import {
    PUBDEV_PACKAGE_URL,
    PUBDEV_SCORE_URL,
    PUBDEV_SEARCH_URL,
    DEFAULT_USER_AGENT,
    RATE_LIMIT_DELAY_MS,
} from '../config/constants.js';

const logger = createLogger('PUBDEV_ADAPTER');

/**
 * pub.dev API 클라이언트
 */

/**
 * 패키지 기본 정보 가져오기
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
export async function fetchPackageInfo(packageName) {
    return retryWithBackoff(
        async () => {
            const url = PUBDEV_PACKAGE_URL(packageName);
            logger.debug(`Fetching package info: ${packageName}`, { url });

            const response = await fetch(url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.warn(`Package not found: ${packageName}`);
                    return null;
                }
                throw new Error(`pub.dev API error: ${response.status}`);
            }

            const data = await response.json();
            const latest = data.latest;

            const result = {
                name: data.name,
                version: latest.version,
                description: latest.pubspec?.description || '',
                homepage: latest.pubspec?.homepage || '',
                repository: latest.pubspec?.repository || '',
                published: latest.published,
            };

            logger.info(`Package info fetched: ${packageName}`, { version: result.version });
            return result;
        },
        {
            shouldRetry: isRetryableError,
        }
    );
}

/**
 * 패키지 점수 정보 가져오기
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
export async function fetchPackageScore(packageName) {
    return retryWithBackoff(
        async () => {
            const url = PUBDEV_SCORE_URL(packageName);
            logger.debug(`Fetching package score: ${packageName}`, { url });

            const response = await fetch(url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.warn(`Package score not found: ${packageName}`);
                    return null;
                }
                throw new Error(`pub.dev Score API error: ${response.status}`);
            }

            const data = await response.json();

            const result = {
                grantedPoints: data.grantedPoints || 0,
                maxPoints: data.maxPoints || 0,
                likeCount: data.likeCount || 0,
                popularityScore: data.popularityScore || 0,
            };

            logger.info(`Package score fetched: ${packageName}`, result);
            return result;
        },
        {
            shouldRetry: isRetryableError,
        }
    );
}

/**
 * 패키지 검색
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchPackages(query, limit = 10) {
    return retryWithBackoff(
        async () => {
            const url = `${PUBDEV_SEARCH_URL}?q=${encodeURIComponent(query)}`;
            logger.debug(`Searching packages: ${query}`, { url, limit });

            const response = await fetch(url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
            });

            if (!response.ok) {
                throw new Error(`pub.dev Search API error: ${response.status}`);
            }

            const data = await response.json();
            const packages = data.packages || [];

            // 상위 N개만 반환
            const results = packages.slice(0, limit).map((pkg) => ({
                id: pkg.package,
                name: pkg.package,
                description: pkg.description || '',
            }));

            logger.info(`Search completed: ${query}`, { resultCount: results.length });
            return results;
        },
        {
            shouldRetry: isRetryableError,
        }
    );
}

/**
 * 패키지 전체 목록 페이지네이션 (인덱스 수집용)
 * @param {string} nextUrl - 다음 페이지 URL (없으면 초기 URL 사용)
 * @returns {Promise<{packages: Array<string>, nextUrl: string|null}>}
 */
export async function fetchPackageListPage(nextUrl = null) {
    return retryWithBackoff(
        async () => {
            const url = nextUrl || `${PUBDEV_SEARCH_URL}?q=flutter`;
            logger.debug(`Fetching package list page`, { url });

            const response = await fetch(url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
            });

            if (!response.ok) {
                throw new Error(`pub.dev API error: ${response.status}`);
            }

            const data = await response.json();
            const packages = (data.packages || []).map((pkg) => pkg.package);
            const next = data.next || null;

            logger.debug(`Fetched ${packages.length} packages`, { hasNext: !!next });

            // Rate limit 방지를 위한 대기
            await sleep(RATE_LIMIT_DELAY_MS);

            return { packages, nextUrl: next };
        },
        {
            shouldRetry: isRetryableError,
        }
    );
}

/**
 * Sleep 유틸리티
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
