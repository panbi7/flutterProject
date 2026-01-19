/**
 * 홈페이지 데이터 API 클라이언트
 */

export async function getHomeData() {
  const apiUrl = '/api/home-data'
  console.log('[HomeAPI] 요청 시작:', apiUrl)

  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    console.log('[HomeAPI] 응답 상태:', res.status, res.statusText)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[HomeAPI] 응답 오류:', {
        status: res.status,
        statusText: res.statusText,
        body: errorText
      })
      return null
    }

    const data = await res.json()
    console.log('[HomeAPI] 응답 데이터:', data)
    return data.success ? data.data : null
  } catch (error) {
    console.error('[HomeAPI] 네트워크 오류:', {
      message: error.message,
      stack: error.stack
    })
    return null
  }
}
