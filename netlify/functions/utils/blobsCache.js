/**
 * Netlify Blobs 캐시 헬퍼
 *
 * 가이드를 영구 저장하여 2회차부터는 Gemini 호출 없이 즉시 반환
 */

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'guides-cache';

/**
 * 캐시된 가이드 조회
 * @param {string} packageId - 패키지 이름
 * @returns {Promise<object|null>} 캐시된 가이드 또는 null
 */
export async function getCachedGuide(packageId) {
  try {
    const store = getStore(STORE_NAME);
    const cached = await store.get(packageId, { type: 'json' });

    if (cached) {
      console.log(`[Blobs Cache] ✅ 캐시 히트: ${packageId}`);
      return cached;
    }

    console.log(`[Blobs Cache] ⚪ 캐시 미스: ${packageId}`);
    return null;
  } catch (error) {
    console.error(`[Blobs Cache] 조회 실패 (${packageId}):`, error.message);
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
    const store = getStore(STORE_NAME);

    // 메타데이터와 함께 저장
    const dataToStore = {
      ...guide,
      cachedAt: new Date().toISOString(),
    };

    await store.setJSON(packageId, dataToStore);
    console.log(`[Blobs Cache] ✅ 캐시 저장: ${packageId}`);
    return true;
  } catch (error) {
    console.error(`[Blobs Cache] 저장 실패 (${packageId}):`, error.message);
    return false;
  }
}

/**
 * 캐시 삭제 (필요시 사용)
 * @param {string} packageId - 패키지 이름
 */
export async function deleteCachedGuide(packageId) {
  try {
    const store = getStore(STORE_NAME);
    await store.delete(packageId);
    console.log(`[Blobs Cache] 🗑️ 캐시 삭제: ${packageId}`);
    return true;
  } catch (error) {
    console.error(`[Blobs Cache] 삭제 실패 (${packageId}):`, error.message);
    return false;
  }
}
