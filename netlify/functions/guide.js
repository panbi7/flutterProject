import { guideService } from '../../src/services/guide.service.js';

export async function handler(event) {
  const { packageId } = event.queryStringParameters || {};

  // CORS 헤더
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

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
    const guide = await guideService.generateGuide(packageId);
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

    // 구체적인 에러 메시지 생성
    let errorMessage = error.message;
    if (error.message.includes('not found')) {
      errorMessage = `'${packageId}' 패키지를 찾을 수 없습니다. 지원되는 패키지인지 확인해주세요.`;
    } else if (error.message.includes('API')) {
      errorMessage = `AI 서비스 오류: ${error.message}`;
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
