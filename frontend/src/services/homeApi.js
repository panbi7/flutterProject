/**
 * 홈페이지 데이터 API 클라이언트
 */

export async function getHomeData() {
  const apiUrl = '/api/home-data'

  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      console.error('[HomeAPI] 응답 오류:', res.status)
      return null
    }

    const data = await res.json()
    return data.success ? data.data : null
  } catch (error) {
    console.error('[HomeAPI] 네트워크 오류:', error)
    return null
  }
}
