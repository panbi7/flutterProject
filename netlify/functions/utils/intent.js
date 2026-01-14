// Simple rule matching per spec
export function simpleRuleMatch(message) {
  const msg = (message || '').trim().toLowerCase()
  if (!msg) {
    return { type: 'clarify', intent: 'auth_basic' }
  }

  const includesAny = (arr) => arr.some((k) => msg.includes(k))

  if (includesAny(['구글', 'google', '카카오', 'kakao', '애플', 'apple', '네이버', 'social', '소셜'])) {
    return { type: 'feature_request', intent: 'auth_social' }
  }
  if (includesAny(['로그인', 'auth', 'login', 'sign in', 'signin', '이메일', '비밀번호'])) {
    return { type: 'feature_request', intent: 'auth_basic' }
  }
  if (includesAny(['지도', 'map', 'location', '구글맵', '네이버 지도', '카카오맵', 'flutter_map', '맵'])) {
    return { type: 'feature_request', intent: 'map' }
  }

  if (includesAny(['안녕', 'hello', 'hi', '하이', '반가워', '반갑', '누구야', '소개해줘', 'thanks', 'thank you', '고마워'])) {
    return { type: 'smalltalk', intent: 'auth_basic' }
  }

  if (includesAny(['어떻게', '방법', 'detail', 'more info', '설명', '가이드', 'guide']) || msg.endsWith('?')) {
    return { type: 'followup_question', intent: 'auth_basic' }
  }

  if (msg.length <= 3) {
    return { type: 'clarify', intent: 'auth_basic' }
  }
  return null
}
