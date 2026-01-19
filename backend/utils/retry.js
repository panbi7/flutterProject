import { createLogger } from './logger.js';
import { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_BASE_MS } from '../config/constants.js';

const logger = createLogger('RETRY');

/**
 * 지수 백오프를 사용한 재시도 로직
 * @param {Function} fn - 재시도할 함수
 * @param {Object} options - 옵션
 * @param {number} options.maxAttempts - 최대 시도 횟수
 * @param {number} options.baseDelay - 기본 대기 시간 (ms)
 * @param {Function} options.shouldRetry - 재시도 여부 판단 함수
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxAttempts = MAX_RETRY_ATTEMPTS,
        baseDelay = RETRY_BACKOFF_BASE_MS,
        shouldRetry = (error) => true,
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // 재시도 여부 확인
            if (!shouldRetry(error)) {
                logger.warn(`Not retrying due to error type`, { error: error.message });
                throw error;
            }

            // 마지막 시도였다면 에러 던지기
            if (attempt === maxAttempts) {
                logger.error(`Max retry attempts (${maxAttempts}) reached`, { error: error.message });
                throw error;
            }

            // 지수 백오프 계산
            const delay = baseDelay * Math.pow(2, attempt - 1);
            logger.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`, {
                error: error.message,
            });

            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Rate Limit 에러 감지
 */
export function isRateLimitError(error) {
    return (
        error?.response?.status === 429 ||
        error?.status === 429 ||
        error?.message?.includes('429') ||
        error?.message?.toLowerCase().includes('rate limit')
    );
}

/**
 * 네트워크 에러 감지
 */
export function isNetworkError(error) {
    return (
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ENOTFOUND' ||
        error?.message?.toLowerCase().includes('network')
    );
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryableError(error) {
    return isRateLimitError(error) || isNetworkError(error);
}

/**
 * Sleep 유틸리티
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
