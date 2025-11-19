import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_API_KEY, GEMINI_MODEL, ALLOWED_INTENTS, ALLOWED_TYPES } from './constants.js'

let genAI = null
let model = null

function initializeGemini() {
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
  }
}

export async function callGeminiClassifier(userMessage) {
  const prompt =
  `너는 Flutter 도우미다. 사용자의 상황에 맞는 최적의 패키지를 추천해야 한다.

다음 규칙에 따라 사용자의 문장을 분류하라:

**type 분류:**
- feature_request: Flutter 기능 구현/패키지 추천이 필요한 질문
- followup_question: 이미 추천한 기능에 대한 추가 질문
- smalltalk: 인사/잡담
- clarify: 모호하거나 추가 정보가 필요한 경우

**intent 분류 (사용자 시나리오 기반):**

인증 관련:
- auth_quick_start: "빠르게", "간단하게", "프로토타입", "MVP", "급해" 등 → 빠른 구현을 원함
- auth_korea: "한국", "카카오", "네이버", "국내" 등 → 한국 사용자 타겟
- auth_social: "구글", "애플", "소셜", "Google", "Apple", "Facebook" 등 → 소셜 로그인
- auth_secure: "보안", "안전", "금융", "의료", "암호화" 등 → 보안 중시
- auth_custom: "백엔드", "서버", "JWT", "토큰", "API" 언급 → 커스텀 백엔드
- auth_basic: 위에 해당 안 되는 일반 로그인/회원가입

기타:
- map: 지도, 위치, 맵 관련

**우선순위:**
1. 사용자가 명시한 시나리오나 요구사항을 최우선으로 고려
2. 키워드가 여러 개면 가장 강조된 것 선택
3. 불명확하면 auth_basic 또는 clarify

출력은 JSON 한 줄만 반환하라.
예시:
- "카카오톡으로 로그인하고 싶어" → {"type":"feature_request","intent":"auth_korea"}
- "빠르게 로그인 기능 만들고 싶어" → {"type":"feature_request","intent":"auth_quick_start"}
- "보안이 중요한 앱인데 로그인 어떻게?" → {"type":"feature_request","intent":"auth_secure"}
- "내 서버 API가 있는데 토큰 저장" → {"type":"feature_request","intent":"auth_custom"}

사용자 문장: "${userMessage}"`

  try {
    initializeGemini()

    if (!model) {
      const errorMsg = !GEMINI_API_KEY
        ? 'GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.'
        : 'Gemini 모델 초기화 실패'
      console.warn('[AI INTENT] Gemini API key not configured, using fallback')
      return {
        type: 'feature_request',
        intent: 'auth_basic',
        geminiRaw: `ERROR: ${errorMsg}`
      }
    }

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    console.log('[AI INTENT] Gemini raw response:', text)

    // JSON 추출
    const match = text.match(/\{[^}]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        const type = parsed.type && String(parsed.type).trim()
        const intent = parsed.intent && String(parsed.intent).trim()
        const validType = ALLOWED_TYPES.includes(type) ? type : 'clarify'
        const validIntent = ALLOWED_INTENTS.includes(intent) ? intent : 'auth_basic'
        return { type: validType, intent: validIntent, geminiRaw: text }
      } catch (parseError) {
        console.warn('[AI INTENT] JSON parse error:', parseError)
        return { type: 'clarify', intent: 'auth_basic', geminiRaw: text }
      }
    }

    console.warn('[AI INTENT] No valid JSON found in response:', text)
    return { type: 'feature_request', intent: 'auth_basic', geminiRaw: text }
  } catch (error) {
    console.warn('[AI INTENT] Gemini API error, using fallback. Error:', error.message)
    return { type: 'feature_request', intent: 'auth_basic', geminiRaw: `Error: ${error.message}` }
  }
}
