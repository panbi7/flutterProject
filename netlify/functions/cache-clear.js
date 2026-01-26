/**
 * 가이드 캐시 삭제 API
 *
 * 사용법: GET /api/cache-clear?packageId=file_picker&secret=YOUR_SECRET
 * 전체 삭제: GET /api/cache-clear?all=true&secret=YOUR_SECRET
 * 목록 조회: GET /api/cache-clear?secret=YOUR_SECRET
 */

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'guides-cache';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'flutter-guide-admin-2024';

/**
 * Blobs store 가져오기 (환경 변수 기반 설정 지원)
 */
function getConfiguredStore() {
  // Netlify 환경에서 자동 설정되지 않은 경우를 대비한 명시적 설정
  const config = {};

  // 환경 변수가 있으면 명시적으로 설정
  if (process.env.NETLIFY_SITE_ID) {
    config.siteID = process.env.NETLIFY_SITE_ID;
  }
  if (process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN) {
    config.token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN;
  }

  return getStore({ name: STORE_NAME, ...config });
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // CORS preflight 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // 간단한 인증
  const { packageId, secret, all } = event.queryStringParameters || {};

  if (secret !== ADMIN_SECRET) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const store = getConfiguredStore();

    if (all === 'true') {
      // 전체 목록 조회 후 삭제
      const { blobs } = await store.list();
      const deleted = [];

      for (const blob of blobs) {
        await store.delete(blob.key);
        deleted.push(blob.key);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `${deleted.length}개 캐시 삭제 완료`,
          deleted,
        }),
      };
    }

    if (!packageId) {
      // 캐시 목록 조회
      const { blobs } = await store.list();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          cached: blobs.map(b => b.key),
          count: blobs.length,
        }),
      };
    }

    // 특정 패키지 캐시 삭제
    await store.delete(packageId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `'${packageId}' 캐시 삭제 완료`,
      }),
    };
  } catch (error) {
    console.error('[Cache Clear] Error:', error);

    // Blobs 설정 오류인 경우 친절한 메시지
    if (error.message.includes('not been configured')) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Netlify Blobs가 설정되지 않았습니다.',
          hint: 'Netlify 대시보드에서 NETLIFY_SITE_ID와 NETLIFY_AUTH_TOKEN 환경 변수를 설정하세요.',
          details: error.message,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
}
