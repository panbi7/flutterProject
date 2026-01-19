/**
 * 애플리케이션 전역 상수 정의
 */

// API URLs
export const PUBDEV_API_BASE = 'https://pub.dev/api';
export const PUBDEV_SEARCH_URL = `${PUBDEV_API_BASE}/search`;
export const PUBDEV_PACKAGE_URL = (packageName) => `${PUBDEV_API_BASE}/packages/${packageName}`;
export const PUBDEV_SCORE_URL = (packageName) => `${PUBDEV_API_BASE}/packages/${packageName}/score`;
export const PUBDEV_EXAMPLE_URL = (packageName) => `https://pub.dev/packages/${packageName}/example`;

// Rate Limiting
export const RATE_LIMIT_DELAY_MS = 500; // pub.dev API 호출 간 대기 시간
export const MAX_RETRY_ATTEMPTS = 5; // 최대 재시도 횟수
export const RETRY_BACKOFF_BASE_MS = 2000; // 재시도 시 기본 대기 시간

// Cache Settings
export const CACHE_TTL = {
    PACKAGE_INFO: 24 * 60 * 60 * 1000, // 24시간 (밀리초)
    GUIDE: Infinity, // 버전별 영구 캐싱
    INDEX: 7 * 24 * 60 * 60 * 1000, // 7일
};

// Gemini Settings
export const GEMINI_CONFIG = {
    GUIDE_GENERATION: {
        temperature: 0.2,
        maxOutputTokens: 8192,
    },
    INTENT_CLASSIFICATION: {
        temperature: 0,
        maxOutputTokens: 2000,
    },
};

// Allowed Intent Types
export const ALLOWED_INTENTS = [
    'auth_basic',
    'auth_social',
    'auth_quick_start',
    'auth_korea',
    'auth_secure',
    'auth_custom',
    'map',
    'state_management',
    'network_http',
    'routing',
    'local_db',
    'media',
    'firebase',
    'storage',
    'ui_design',
    'forms',
    'device',
    'native',
    'utils',
    'rendering',
];

export const ALLOWED_TYPES = [
    'feature_request',
    'followup_question',
    'smalltalk',
    'clarify',
    'package_query',
];

// Search Settings
export const SEARCH_RESULT_LIMIT = 10; // 검색 결과 최대 개수
export const PUBDEV_SEARCH_PAGE_SIZE = 10; // pub.dev API 페이지 크기

// HTTP Headers
export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';
