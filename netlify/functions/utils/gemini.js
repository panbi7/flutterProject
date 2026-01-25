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

/**
 * Gemini를 사용하여 특정 패키지에 대한 구현 가이드를 생성합니다.
 */
export async function callGeminiForGuide(prompt) {
  try {
    initializeGemini()

    if (!model) {
      throw new Error('Gemini API key not configured')
    }

    console.log(`[GEMINI GUIDE] 프롬프트 길이: ${prompt.length}자`)

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2, // 약간 높여서 더 자연스러운 응답
        topP: 0.8,
        topK: 40,
        // maxOutputTokens 제한 없음 - 상세한 가이드 생성을 위해
      },
    })

    const response = await result.response
    const text = response.text()

    console.log(`[GEMINI GUIDE] 응답 길이: ${text.length}자`)

    // 응답이 너무 짧으면 경고
    if (text.length < 500) {
      console.warn(`[GEMINI GUIDE] 응답이 너무 짧음: ${text.length}자`)
    }

    return text
  } catch (error) {
    const errorMsg = !GEMINI_API_KEY
      ? '가이드 생성용 GEMINI_API_KEY가 설정되지 않았습니다 (Netlify 설정 확인).'
      : error.message

    console.error('[GEMINI GUIDE] Error:', errorMsg)

    // 상세 에러 로깅
    if (error.response) {
      console.error('[GEMINI GUIDE] Response error:', error.response)
    }

    throw new Error(errorMsg)
  }
}

export async function callGeminiClassifier(userMessage) {
  const prompt = `Classify the following user message into type and intent. You MUST return ONLY a valid JSON object.

User message: "${userMessage}"

CLASSIFICATION RULES:

1. TYPE (choose exactly one):
   - "smalltalk" = Greetings, thanks, casual chat (안녕, 고마워, hi, hello, 잘가, 반가워)
   - "feature_request" = Wants to implement a Flutter feature (로그인 만들고 싶어, 지도 보여줘, 결제 붙이고 싶어)
   - "package_query" = Asks for usage, examples, or guides for a specific package (flutter_bloc 어떻게 써?, dio 사용법, provider 예제 보여줘)
   - "followup_question" = Follow-up question about a previous answer
   - "clarify" = Unclear or ambiguous message

2. INTENT (choose exactly one):
   - "firebase" = Firebase services (파이어베이스, auth, firestore, analytics, messaging, crashlytics, remote config)
   - "state_management" = State management (상태 관리, 공유, provider, bloc, riverpod, getx, signals)
   - "network_http" = Network/API (네트워크, http, api, 통신, dio, shelf, connectivity)
   - "storage" = Database/Storage (데이터 저장, db, 로컬 저장소, sqlite, sqflite, hive, drift, shared_preferences, secure storage)
   - "media" = Media/Video/Audio/Camera (비디오, 동영상, 오디오, 음악, 카메라, 사진, video, audio, camera, player)
   - "routing" = Navigation/Routing (라우팅, 네비게이션, 화면 전환, go_router, auto_route)
   - "ui_design" = UI/Animation (디자인, 애니메이션, lottie, shimmer, icon, font awesome, badge, carousel)
   - "forms" = Forms/Input (폼, 입력, 유효성 검사, pinput, form builder)
   - "device" = Device Features/Hardware (권한, 센서, 위치, 지참, 지리, permission, geolocator, sensor, vibration)
   - "native" = Native/FFI/Desktop (네이티브 연동, ffi, win32, window manager, package info)
   - "utils" = Utilities/Helpers (유틸리티, uuid, crypto, path, logger, retry, intl, date, time)
   - "rendering" = Content Rendering (svg, html, xml, yaml, markdown, image rendering)
   - "auth_basic" = Default/fallback or general question

3. packageName:
   - If TYPE is "package_query", extract the package name (e.g., "flutter_bloc", "dio", "provider").
   - Extract the EXACT name from pub.dev if possible.
   - Otherwise, this field should be omitted.

EXAMPLES (copy the exact format):
Input: "파이어베이스 로그인" → Output: {"type":"feature_request","intent":"firebase"}
Input: "상태 관리 패키지 추천" → Output: {"type":"feature_request","intent":"state_management"}
Input: "dio 사용법" → Output: {"type":"package_query","intent":"network_http","packageName":"dio"}
Input: "로컬 DB 쓰고 싶어" → Output: {"type":"feature_request","intent":"storage"}
Input: "비디오 재생 가이드" → Output: {"type":"feature_request","intent":"media"}
Input: "애니메이션 넣고 싶어" → Output: {"type":"feature_request","intent":"ui_design"}
Input: "gps 위치 정보" → Output: {"type":"feature_request","intent":"device"}
Input: "svg 이미지 보여주기" → Output: {"type":"feature_request","intent":"rendering"}
Input: "uuid 생성" → Output: {"type":"feature_request","intent":"utils"}

NOW CLASSIFY: "${userMessage}"

Return format: {"type":"...","intent":"...","packageName":"..."}
(The "packageName" key is ONLY included when the type is "package_query")
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
        maxOutputTokens: 2000,
      },
    })
    const response = await result.response
    const text = response.text()

    console.log('[AI INTENT] Gemini raw response:', text)

    // JSON 추출
    const match = text.match(/\{.*\}/s) // Use 's' flag to match across newlines
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        const type = parsed.type && String(parsed.type).trim()
        const intent = parsed.intent && String(parsed.intent).trim()
        const packageName = parsed.packageName && String(parsed.packageName).trim()

        const validType = ALLOWED_TYPES.includes(type) ? type : 'clarify'
        const validIntent = ALLOWED_INTENTS.includes(intent) ? intent : 'auth_basic'

        const result = { type: validType, intent: validIntent, geminiRaw: text }
        if (validType === 'package_query' && packageName) {
          result.packageName = packageName
        }
        return result
      } catch (parseError) {
        console.warn('[AI INTENT] JSON parse error:', parseError)
        return { type: 'clarify', intent: 'auth_basic', geminiRaw: text }
      }
    }

    console.warn('[AI INTENT] No valid JSON found in response:', text)
    return { type: 'feature_request', intent: 'auth_basic', geminiRaw: text }
  } catch (error) {
    const errorMsg = !GEMINI_API_KEY
      ? 'GEMINI_API_KEY 환경 변수가 설정되지 않았습니다 (Netlify Dashboard 확인 필요).'
      : error.message
    console.error('[AI INTENT] Gemini API error:', errorMsg)
    return {
      type: 'feature_request',
      intent: 'auth_basic',
      source: 'fallback_error',
      geminiRaw: `Error: ${errorMsg}`,
      errorMessage: errorMsg
    }
  }
}
