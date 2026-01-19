import { generateGuideFromPubDev } from './utils/guideGenerator.js';

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
    console.log(`[Guide API] 가이드 생성 시작: ${packageId}`);
    const guide = await generateGuideFromPubDev(packageId);

    if (!guide) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `'${packageId}' 패키지를 찾을 수 없습니다.`,
          fallback: {
            message: 'pub.dev에서 공식 문서를 확인해주세요.',
            url: `https://pub.dev/packages/${packageId}`
          }
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guide,
      }),
    };
  } catch (error) {
    console.error(`[Guide API] 가이드 생성 실패 - ${packageId}:`, error.message);

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
