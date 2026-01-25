/**
 * 패키지 구현 가이드 API
 *
 * 흐름:
 * 1. Blobs 캐시 확인 → 있으면 즉시 반환 (토큰 0)
 * 2. 없으면 Gemini로 생성 → Blobs에 저장 → 반환
 */

import { generateGuide } from './utils/guideGenerator.js';
import { getCachedGuide, setCachedGuide } from './utils/blobsCache.js';

export async function handler(event) {
  const { packageId } = event.queryStringParameters || {};

  // CORS 헤더
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!packageId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'packageId 파라미터가 필요합니다.',
      }),
    };
  }

  try {
    console.log(`[Guide API] 요청: ${packageId}`);

    // 1. Blobs 캐시 확인
    const cached = await getCachedGuide(packageId);
    if (cached) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          guide: { ...cached, source: 'cache' },
        }),
      };
    }

    // 2. 캐시 미스 → Gemini로 생성
    console.log(`[Guide API] 캐시 미스, Gemini 생성 시작: ${packageId}`);
    const guide = await generateGuide(packageId);

    if (!guide) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `'${packageId}' 패키지를 찾을 수 없습니다.`,
          fallback: {
            message: 'pub.dev에서 공식 문서를 확인해주세요.',
            url: `https://pub.dev/packages/${packageId}`,
          },
        }),
      };
    }

    // 3. Blobs에 저장 (비동기, 응답 지연 없음)
    setCachedGuide(packageId, guide).catch((err) => {
      console.error(`[Guide API] 캐시 저장 실패:`, err.message);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guide: { ...guide, source: 'generated' },
      }),
    };
  } catch (error) {
    console.error(`[Guide API] 에러 (${packageId}):`, error.message);

    let errorMessage = error.message;
    if (error.message.includes('GEMINI_API_KEY')) {
      errorMessage = 'AI 서비스 API 키가 설정되지 않았습니다. 관리자에게 문의하세요.';
    } else if (error.message.includes('Gemini')) {
      errorMessage = `AI 가이드 생성에 실패했습니다: ${error.message}`;
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        packageId,
      }),
    };
  }
}
