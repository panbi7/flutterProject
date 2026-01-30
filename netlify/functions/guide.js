/**
 * 패키지 구현 가이드 API v4.0
 *
 * 흐름:
 * 1. Blobs 캐시 확인 (실패해도 계속 진행)
 * 2. 없으면 Gemini로 생성
 * 3. 생성 후 캐시 저장 시도 (실패해도 응답은 반환)
 */

import { generateGuide } from './utils/guideGenerator.js';
import { normalizeGuide } from './utils/guideNormalizer.js';

// Blobs import를 동적으로 처리 (오류 방지)
let blobsModule = null;

async function getBlobsModule() {
  if (blobsModule === null) {
    try {
      blobsModule = await import('./utils/blobsCache.js');
    } catch (e) {
      console.warn('[Guide API] Blobs 모듈 로드 실패:', e.message);
      blobsModule = false;
    }
  }
  return blobsModule;
}

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

    // 1. Blobs 캐시 확인 (실패해도 계속 진행)
    let cached = null;
    try {
      const blobs = await getBlobsModule();
      if (blobs && blobs.getCachedGuide) {
        cached = await blobs.getCachedGuide(packageId);
      }
    } catch (cacheError) {
      console.warn(`[Guide API] 캐시 조회 실패 (무시하고 계속):`, cacheError.message);
    }

    if (cached) {
      console.log(`[Guide API] ✅ 캐시 히트: ${packageId}`);
      const normalized = normalizeGuide(cached, { packageId });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          guide: { ...normalized, source: 'cache' },
        }),
      };
    }

    // 2. 캐시 미스 → Gemini로 생성
    console.log(`[Guide API] 캐시 미스, 가이드 생성 시작: ${packageId}`);
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

    const normalized = normalizeGuide(guide, { packageId });

    // 3. Blobs에 저장 시도 (실패해도 응답은 반환)
    try {
      const blobs = await getBlobsModule();
      if (blobs && blobs.setCachedGuide) {
        await blobs.setCachedGuide(packageId, normalized);
        console.log(`[Guide API] ✅ 캐시 저장 완료: ${packageId}`);
      }
    } catch (saveError) {
      console.warn(`[Guide API] 캐시 저장 실패 (무시):`, saveError.message);
    }

    // source 표시
    const source = guide.source === 'fallback' ? 'fallback' : 'generated';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guide: { ...normalized, source },
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
