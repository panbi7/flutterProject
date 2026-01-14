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

    // 1단계: 캐시된 가이드 확인 (JSON 또는 TXT)
    let guide = loadGuide(packageId)

    // 2단계: 없으면 실시간 생성
    if (!guide) {
      console.log(`[Guide API] 캐시 없음, 실시간 생성 시도: ${packageId}`)
      try {
        guide = await generateGuideFromPubDev(packageId)
      } catch (e) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: `가이드 생성 실패: ${e.message}`,
            fallback: {
              message: 'pub.dev에서 공식 문서를 확인해주세요.',
              url: `https://pub.dev/packages/${packageId}`
            }
          })
        }
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
