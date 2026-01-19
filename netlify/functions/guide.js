import { loadGuide } from './utils/guideLoader.js'
import { generateGuideFromPubDev } from './utils/guideGenerator.js'

export async function handler(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  }

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const packageId = event.queryStringParameters?.packageId

    if (!packageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'packageId 파라미터가 필요합니다.'
        })
      }
    }

    // 1단계: 실시간 생성 (Real-time Scraping & Generation)
    let guide = null;
    let errorFromGeneration = null;

    try {
      console.log(`[Guide API] 실시간 가이드 생성 시도: ${packageId}`);
      guide = await generateGuideFromPubDev(packageId);
    } catch (e) {
      console.warn(`[Guide API] 실시간 생성 실패 (토큰 한도 초과 등): ${e.message}`);
      errorFromGeneration = e.message;
    }

    

    // 3단계: 여전히 없으면 에러 반환
    if (!guide) {
      return {
        statusCode: 500, // or 429 if we want to propagate, but usually valid fallback is better
        headers,
        body: JSON.stringify({
          success: false,
          error: `가이드 생성 실패: ${errorFromGeneration || '알 수 없는 오류'}`,
          fallback: {
            message: 'pub.dev에서 공식 문서를 확인해주세요.',
            url: `https://pub.dev/packages/${packageId}`
          }
        })
      }
    }

    if (!guide) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `'${packageId}' 가이드를 찾을 수 없으며 생성에도 실패했습니다.`,
          fallback: {
            message: 'pub.dev에서 공식 문서를 확인해주세요.',
            url: `https://pub.dev/packages/${packageId}`
          }
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guide
      })
    }
  } catch (error) {
    console.error('Error in guide function:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `서버 내부 오류: ${error.message}`
      })
    }
  }
}
