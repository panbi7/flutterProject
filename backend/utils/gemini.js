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
  const prompt = `Classify the following user message into type and intent. You MUST return ONLY a valid JSON object.

User message: "${userMessage}"

CLASSIFICATION RULES:

1. TYPE (choose exactly one):
   - "smalltalk" = Greetings, thanks, casual chat (안녕, 고마워, hi, hello, 잘가, 반가워)
   - "feature_request" = Wants to implement Flutter feature (로그인 만들고 싶어, 지도 보여줘, 결제 붙이고 싶어)
   - "followup_question" = Follow-up question about previous answer
   - "clarify" = Unclear or ambiguous message

2. INTENT (choose exactly one):
   - "auth_korea" = Korean login (카카오, 네이버)
   - "auth_social" = Social login (소셜, 구글, 애플, Google, Apple, Facebook, social)
   - "auth_quick_start" = Quick implementation (빠르게, 간단)
   - "auth_secure" = Security focus (보안, 안전)
   - "auth_custom" = Custom backend (JWT, 토큰, 서버)
   - "map" = Map/location feature (지도, 맵, 위치)
   - "auth_basic" = Default/general auth

EXAMPLES (copy the exact format):
Input: "안녕" → Output: {"type":"smalltalk","intent":"auth_basic"}
Input: "안녕하세요" → Output: {"type":"smalltalk","intent":"auth_basic"}
Input: "hi" → Output: {"type":"smalltalk","intent":"auth_basic"}
Input: "고마워" → Output: {"type":"smalltalk","intent":"auth_basic"}
Input: "카카오 로그인" → Output: {"type":"feature_request","intent":"auth_korea"}
Input: "소셜 로그인" → Output: {"type":"feature_request","intent":"auth_social"}
Input: "구글 로그인" → Output: {"type":"feature_request","intent":"auth_social"}
Input: "지도 보여줘" → Output: {"type":"feature_request","intent":"map"}

NOW CLASSIFY: "${userMessage}"

Return format: {"type":"...","intent":"..."}
NO explanation, NO markdown, ONLY JSON:`

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1000,
      },
    })
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
