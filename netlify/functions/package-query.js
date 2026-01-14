/**
 * 패키지 조회 Netlify Function
 * 사용자가 "http 패키지 알려줘" 같은 질문을 하면
 * 패키지 가이드를 반환합니다
 */

import { searchPackage } from './utils/package-search.js';

export async function handler(event) {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { packageName } = JSON.parse(event.body || '{}');

    if (!packageName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'packageName is required' }),
      };
    }

    console.log(`[PACKAGE-QUERY] 📦 "${packageName}" 조회 요청`);

    // 패키지 검색 (3단계: top100 → generated-guides → pub.dev)
    const result = await searchPackage(packageName);

    if (!result) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Package not found',
          message: `"${packageName}" 패키지를 찾을 수 없습니다. pub.dev에서 패키지 이름을 확인해주세요.`,
        }),
      };
    }

    console.log(`[PACKAGE-QUERY] ✅ "${packageName}" 조회 성공 (source: ${result.source})`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        packageName: result.packageName,
        source: result.source, // 'pregenerated' 또는 'realtime'
        guide: result.guide,
        packageInfo: result.packageInfo || null,
      }),
    };
  } catch (error) {
    console.error('[PACKAGE-QUERY] ❌ 오류 발생:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
      }),
    };
  }
}
