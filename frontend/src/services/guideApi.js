/**
 * 패키지 구현 가이드 API (브라우저 캐시 지원)
 */

const CACHE_KEY_PREFIX = 'guide_cache_';
const CACHE_VERSION = 'v3'; // 가이드 버전 변경 시 업데이트
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일

/**
 * 브라우저 캐시에서 가이드 조회
 */
function getFromCache(packageId) {
  try {
    const key = `${CACHE_KEY_PREFIX}${CACHE_VERSION}_${packageId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age > CACHE_TTL) {
      localStorage.removeItem(key);
      console.log('[GuideAPI] 캐시 만료:', packageId);
      return null;
    }

    console.log('[GuideAPI] 🚀 브라우저 캐시 HIT:', packageId);
    return data;
  } catch (e) {
    console.warn('[GuideAPI] 캐시 읽기 실패:', e);
    return null;
  }
}

/**
 * 브라우저 캐시에 가이드 저장
 */
function saveToCache(packageId, data) {
  try {
    const key = `${CACHE_KEY_PREFIX}${CACHE_VERSION}_${packageId}`;
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
    console.log('[GuideAPI] 💾 브라우저 캐시 저장:', packageId);
  } catch (e) {
    console.warn('[GuideAPI] 캐시 저장 실패:', e);
    // 용량 초과 시 오래된 캐시 정리
    if (e.name === 'QuotaExceededError') {
      clearOldCache();
    }
  }
}

/**
 * 오래된 캐시 정리
 */
function clearOldCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));
  keys.forEach(key => {
    if (!key.includes(CACHE_VERSION)) {
      localStorage.removeItem(key);
    }
  });
  console.log('[GuideAPI] 🧹 오래된 캐시 정리 완료');
}

export async function getGuide(packageId) {
  // 1. 브라우저 캐시 먼저 확인
  const cached = getFromCache(packageId);
  if (cached) {
    return { success: true, guide: { ...cached, source: 'browser-cache' } };
  }

  // 2. 서버 API 호출
  try {
    const apiUrl = `/api/guide?packageId=${packageId}`;
    console.log('[GuideAPI] 서버 요청:', apiUrl);

    const response = await fetch(apiUrl);
    console.log('[GuideAPI] 응답 상태:', response.status, response.statusText);

    // 응답 텍스트를 먼저 읽기
    const responseText = await response.text();
    console.log('[GuideAPI] 응답 원문:', responseText.substring(0, 500));

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[GuideAPI] 응답 데이터:', data);
    } catch (parseError) {
      console.error('[GuideAPI] JSON 파싱 실패:', parseError);

      // 502 등 서버 오류일 때 원문 메시지 반환
      const errorDetail = responseText || `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: `서버 오류 (${response.status})`,
        serverMessage: errorDetail
      };
    }

    // Netlify Functions 오류 형식 처리
    if (data.errorType || data.errorMessage) {
      return {
        success: false,
        error: data.errorMessage || data.errorType,
        errorType: data.errorType,
        trace: data.trace
      };
    }

    // 3. 성공 시 브라우저 캐시에 저장
    if (data.success && data.guide) {
      saveToCache(packageId, data.guide);
    }

    return data;
  } catch (error) {
    console.error('[GuideAPI] 가이드 로드 실패:', {
      packageId,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

/**
 * 특정 패키지의 캐시 삭제 (강제 새로고침용)
 */
export function clearGuideCache(packageId) {
  const key = `${CACHE_KEY_PREFIX}${CACHE_VERSION}_${packageId}`;
  localStorage.removeItem(key);
  console.log('[GuideAPI] 캐시 삭제:', packageId);
}

/**
 * 모든 가이드 캐시 삭제
 */
export function clearAllGuideCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));
  keys.forEach(key => localStorage.removeItem(key));
  console.log('[GuideAPI] 🧹 전체 캐시 삭제:', keys.length, '개');
}
