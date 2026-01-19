import * as cheerio from 'cheerio';
import { createLogger } from '../utils/logger.js';
import { retryWithBackoff, isRetryableError } from '../utils/retry.js';
import { PUBDEV_EXAMPLE_URL, DEFAULT_USER_AGENT } from '../config/constants.js';

const logger = createLogger('SCRAPER_ADAPTER');

/**
 * pub.dev 스크래퍼 (예제 코드 추출)
 */

/**
 * 패키지의 예제 코드 스크래핑
 * @param {string} packageName
 * @returns {Promise<string|null>}
 */
export async function scrapeExampleCode(packageName) {
    return retryWithBackoff(
        async () => {
            const url = PUBDEV_EXAMPLE_URL(packageName);
            logger.debug(`Scraping example code: ${packageName}`, { url });

            const response = await fetch(url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.warn(`Example page not found: ${packageName}`);
                    return null;
                }
                throw new Error(`Failed to fetch example page: ${response.status}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // pub.dev 예제 페이지에서 코드 블록 추출
            // 1. Dart 언어 코드 블록 우선
            let code = $('pre.language-dart code').first().text();

            // 2. Fallback: 일반 코드 블록
            if (!code || code.trim().length === 0) {
                code = $('pre code').first().text();
            }

            if (!code || code.trim().length === 0) {
                logger.warn(`No code block found: ${packageName}`);
                return null;
            }

            logger.info(`Example code scraped: ${packageName}`, {
                codeLength: code.length,
            });

            return code;
        },
        {
            shouldRetry: isRetryableError,
        }
    );
}

/**
 * 패키지 README 스크래핑 (선택적)
 * @param {string} packageName
 * @returns {Promise<string|null>}
 */
export async function scrapeReadme(packageName) {
    return retryWithBackoff(
        async () => {
            const url = `https://pub.dev/packages/${packageName}`;
            logger.debug(`Scraping README: ${packageName}`, { url });

            const response = await fetch(url, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
            });

            if (!response.ok) {
                logger.warn(`Package page not found: ${packageName}`);
                return null;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // README 섹션 추출
            const readme = $('.detail-info-box').first().text();

            if (!readme || readme.trim().length === 0) {
                logger.warn(`No README found: ${packageName}`);
                return null;
            }

            logger.info(`README scraped: ${packageName}`, {
                readmeLength: readme.length,
            });

            return readme.trim();
        },
        {
            shouldRetry: isRetryableError,
        }
    );
}
