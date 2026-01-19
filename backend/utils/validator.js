/**
 * 데이터 검증 유틸리티
 */

/**
 * 패키지 이름 검증
 */
export function isValidPackageName(name) {
    if (!name || typeof name !== 'string') return false;

    // pub.dev 패키지 이름 규칙: 소문자, 숫자, 언더스코어만 허용
    const pattern = /^[a-z0-9_]+$/;
    return pattern.test(name);
}

/**
 * 버전 문자열 검증
 */
export function isValidVersion(version) {
    if (!version || typeof version !== 'string') return false;

    // Semantic versioning 패턴
    const pattern = /^\d+\.\d+\.\d+/;
    return pattern.test(version);
}

/**
 * Intent 타입 검증
 */
export function isValidIntent(intent, allowedIntents) {
    return allowedIntents.includes(intent);
}

/**
 * Type 검증
 */
export function isValidType(type, allowedTypes) {
    return allowedTypes.includes(type);
}

/**
 * 객체가 비어있는지 확인
 */
export function isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
}

/**
 * 안전한 JSON 파싱
 */
export function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return defaultValue;
    }
}
