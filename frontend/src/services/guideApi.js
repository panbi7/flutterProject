/**
 * 패키지 구현 가이드 API
 */

export async function getGuide(packageId) {
  try {
    const apiUrl = `/api/guide?packageId=${packageId}`;
    console.log('[GuideAPI] 요청 시작:', apiUrl);

    const response = await fetch(apiUrl);
    console.log('[GuideAPI] 응답 상태:', response.status, response.statusText);

    // 응답 텍스트를 먼저 읽기
    const responseText = await response.text();
    console.log('[GuideAPI] 응답 원문:', responseText.substring(0, 500));

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[GuideAPI] 응답 데이터:', data);
    } catch (parseError) {
      console.error('[GuideAPI] JSON 파싱 실패:', parseError);

      // 502 등 서버 오류일 때 원문 메시지 반환
      const errorDetail = responseText || `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: `서버 오류 (${response.status})`,
        serverMessage: errorDetail
      };
    }

    // Netlify Functions 오류 형식 처리
    if (data.errorType || data.errorMessage) {
      return {
        success: false,
        error: data.errorMessage || data.errorType,
        errorType: data.errorType,
        trace: data.trace
      };
    }

    return data;
  } catch (error) {
    console.error('[GuideAPI] 가이드 로드 실패:', {
      packageId,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}
