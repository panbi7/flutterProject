/**
 * Netlify Blobs 캐시 헬퍼
 *
 * 가이드를 영구 저장하여 2회차부터는 Gemini 호출 없이 즉시 반환
 *
 * 환경 변수 설정 필요:
 * - NETLIFY_SITE_ID: Netlify 사이트 ID
 * - NETLIFY_AUTH_TOKEN: Netlify Personal Access Token
 */

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'guides-cache';

/**
 * Blobs store 가져오기 (환경 변수 기반 설정 지원)
 */
function getConfiguredStore() {
  const config = { name: STORE_NAME };

  // 환경 변수가 있으면 명시적으로 설정
  if (process.env.NETLIFY_SITE_ID) {
    config.siteID = process.env.NETLIFY_SITE_ID;
  }
  if (process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN) {
    config.token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN;
  }

  return getStore(config);
}

/**
 * 캐시된 가이드 조회
 * @param {string} packageId - 패키지 이름
 * @returns {Promise<object|null>} 캐시된 가이드 또는 null
 */
export async function getCachedGuide(packageId) {
  try {
    const store = getConfiguredStore();
    const cached = await store.get(packageId, { type: 'json' });

    if (cached) {
      console.log(`[Blobs Cache] ✅ HIT: ${packageId} (Cached at: ${cached.cachedAt || 'unknown'})`);
      return cached;
    }

    console.log(`[Blobs Cache] ⚪ MISS: ${packageId}`);
    return null;
  } catch (error) {
    console.error(`[Blobs Cache] ❌ Get failed (${packageId}):`, error.message);
    return null;
  }
}

/**
 * 가이드를 캐시에 저장
 * @param {string} packageId - 패키지 이름
 * @param {object} guide - 저장할 가이드 객체
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function setCachedGuide(packageId, guide) {
  try {
    const store = getConfiguredStore();

    // 메타데이터와 함께 저장
    const dataToStore = {
      ...guide,
      packageName: packageId,
      cachedAt: new Date().toISOString(),
      generatorVersion: '3.0', // 심층 고도화 엔진 버전
    };

    await store.setJSON(packageId, dataToStore);
    console.log(`[Blobs Cache] ✅ STORED: ${packageId} (Version: ${dataToStore.generatorVersion})`);
    return true;
  } catch (error) {
    console.error(`[Blobs Cache] ❌ Store failed (${packageId}):`, error.message);
    return false;
  }
}

/**
 * 캐시 삭제 (필요시 사용)
 * @param {string} packageId - 패키지 이름
 */
export async function deleteCachedGuide(packageId) {
  try {
    const store = getConfiguredStore();
    await store.delete(packageId);
    console.log(`[Blobs Cache] 🗑️ DELETED: ${packageId}`);
    return true;
  } catch (error) {
    console.error(`[Blobs Cache] ❌ Delete failed (${packageId}):`, error.message);
    return false;
  }
}
