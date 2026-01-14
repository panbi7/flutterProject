/**
 * 패키지 구현 가이드 API
 */

export async function getGuide(packageId) {
  try {
    const apiUrl = `/api/guide?packageId=${packageId}`;
    const response = await fetch(apiUrl);

    // If API returned a JSON, return it regardless of ok status
    try {
      const data = await response.json();
      return data;
    } catch (e) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      throw new Error('API 응답을 해석할 수 없습니다.');
    }
  } catch (error) {
    console.error('가이드 로드 실패:', error);
    return { success: false, error: error.message };
  }
}
