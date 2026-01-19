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
    console.error('Full error object:', error); // Log the full error object

    // 구체적인 에러 메시지 생성
    let errorMessage = error.message;
    if (error.message.includes('not found in local top_packages.json')) {
      errorMessage = `'${packageId}' 패키지를 찾을 수 없습니다. 지원되는 패키지인지 확인해주세요.`;
    } else if (error.message.includes('AI content generation failed')) {
      errorMessage = `AI 가이드 생성에 실패했습니다. API 키 설정 또는 AI 서비스 상태를 확인해주세요.`;
    } else if (error.message.includes('AI did not return valid JSON')) {
      errorMessage = `AI 응답 형식이 올바르지 않습니다. AI 모델이 JSON을 반환하지 않았습니다.`;
    } else if (error.message.includes('Failed to parse AI response as JSON')) {
      errorMessage = `AI 응답을 처리하는 중 오류가 발생했습니다. AI가 유효한 JSON을 반환했지만 파싱에 실패했습니다.`;
    } else if (error.message.includes('API')) { // General API error
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
