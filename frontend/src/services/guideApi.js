/**
 * 패키지 구현 가이드 API
 */

export async function getGuide(packageId) {
  try {
    const apiUrl = `/api/guide?packageId=${packageId}`;
    console.log('[GuideAPI] 요청 시작:', apiUrl);

    const response = await fetch(apiUrl);
    console.log('[GuideAPI] 응답 상태:', response.status, response.statusText);

    // If API returned a JSON, return it regardless of ok status
    try {
      const data = await response.json();
      console.log('[GuideAPI] 응답 데이터:', data);
      return data;
    } catch (e) {
      console.error('[GuideAPI] JSON 파싱 실패:', e);
      if (!response.ok) {
        const errorMsg = `HTTP error! status: ${response.status} ${response.statusText}`;
        console.error('[GuideAPI]', errorMsg);
        throw new Error(errorMsg);
      }
      throw new Error('API 응답을 해석할 수 없습니다.');
    }
  } catch (error) {
    console.error('[GuideAPI] 가이드 로드 실패:', {
      packageId,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}
