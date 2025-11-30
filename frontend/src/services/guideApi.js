/**
 * 패키지 구현 가이드 API
 */

export async function getGuide(packageId) {
  try {
    const apiUrl = `/api/guide?packageId=${packageId}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      return data.guide;
    } else {
      throw new Error(data.error || '가이드를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('가이드 로드 실패:', error);
    throw error;
  }
}
