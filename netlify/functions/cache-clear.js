/**
 * 가이드 캐시 삭제 API
 *
 * 사용법: GET /api/cache-clear?packageId=file_picker&secret=YOUR_SECRET
 * 전체 삭제: GET /api/cache-clear?all=true&secret=YOUR_SECRET
 */

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'guides-cache';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'flutter-guide-admin-2024';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

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
    const store = getStore(STORE_NAME);

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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
}
