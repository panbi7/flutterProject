import { GoogleGenerativeAI } from '@google/generative-ai'

// ⚠️ 경고: API 키가 브라우저에 노출됩니다!
const GEMINI_API_KEY = 'AIzaSyAHFKSqqGwBUH7_bGDBpGSPC73HthZD6hU'
const GEMINI_MODEL = 'gemini-2.5-flash'

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

const ALLOWED_INTENTS = [
  'auth_basic',
  'auth_social',
  'auth_quick_start',
  'auth_korea',
  'auth_secure',
  'auth_custom',
  'map',
]

const ALLOWED_TYPES = [
  'feature_request',
  'followup_question',
  'smalltalk',
  'clarify',
]

export async function classifyWithGemini(userMessage) {
  console.log('[GEMINI] Starting classification for:', userMessage)

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
    console.log('[GEMINI] Calling API...')
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1000, // Gemini 2.5 Flash의 thinking을 위해 충분한 토큰 제공
      },
    })

    console.log('[GEMINI] API call successful')
    console.log('[GEMINI] Full result:', result)

    const response = await result.response
    console.log('[GEMINI] Response object:', response)
    console.log('[GEMINI] Candidates:', response.candidates)

    const text = response.text()
    console.log('[GEMINI RAW] Text:', text)
    console.log('[GEMINI RAW] Text length:', text.length)

    // JSON 추출
    const match = text.match(/\{[^}]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      const type = ALLOWED_TYPES.includes(parsed.type) ? parsed.type : 'clarify'
      const intent = ALLOWED_INTENTS.includes(parsed.intent) ? parsed.intent : 'auth_basic'

      return {
        type,
        intent,
        source: 'ai',
        geminiRaw: text,
      }
    }

    return {
      type: 'clarify',
      intent: 'auth_basic',
      source: 'ai',
      geminiRaw: text,
    }
  } catch (error) {
    console.error('[GEMINI ERROR] Full error:', error)
    console.error('[GEMINI ERROR] Message:', error.message)
    console.error('[GEMINI ERROR] Stack:', error.stack)
    return {
      type: 'clarify',
      intent: 'auth_basic',
      source: 'error',
      geminiRaw: `Error: ${error.message}`,
    }
  }
}
