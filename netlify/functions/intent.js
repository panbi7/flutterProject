import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
// 무조건 Gemini 2.5 Flash 사용
const GEMINI_MODEL = 'gemini-2.5-flash'

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

let genAI = null
let model = null

function initializeGemini() {
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
  }
}

async function callGeminiClassifier(userMessage) {
  // 모든 메시지를 Gemini가 판단
  const prompt =
  `Classify the user message into type and intent.

User message: "${userMessage}"

Rules:
1. If message is greeting/chitchat → type: "smalltalk"
2. If message requests Flutter feature ("로그인", "지도", "결제") → type: "feature_request"
3. If message asks followup question ("어떻게", "설치") → type: "followup_question"
4. If unclear → type: "clarify"

For intent:
- If mentions "카카오" or "네이버" → auth_korea
- If mentions "구글" or "애플" → auth_social
- If mentions "빠르게" or "간단" → auth_quick_start
- If mentions "지도" or "맵" → map
- Default → auth_basic

Examples:
"카카오 로그인" → {"type":"feature_request","intent":"auth_korea"}
"지도 보여줘" → {"type":"feature_request","intent":"map"}

Return ONLY JSON, no explanation:`

  try {
    initializeGemini()

    if (!model) {
      console.warn('[AI INTENT] Gemini API key not configured, using fallback')
      return { type: 'feature_request', intent: 'auth_basic' }
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 100,
      },
    })
    const response = await result.response
    const text = response.text()

    console.log('[AI INTENT] Gemini raw response:', text)

    const match = text.match(/\{[^}]*\}/)
    if (match) {
      console.log('[AI INTENT] Matched JSON:', match[0])
      try {
        const parsed = JSON.parse(match[0])
        console.log('[AI INTENT] Parsed:', parsed)
        const type = parsed.type && String(parsed.type).trim()
        const intent = parsed.intent && String(parsed.intent).trim()
        console.log('[AI INTENT] Type:', type, 'Intent:', intent)
        const validType = ALLOWED_TYPES.includes(type) ? type : 'clarify'
        const validIntent = ALLOWED_INTENTS.includes(intent) ? intent : 'auth_basic'
        console.log('[AI INTENT] Valid Type:', validType, 'Valid Intent:', validIntent)
        return { type: validType, intent: validIntent, geminiRaw: text }
      } catch (parseError) {
        console.warn('[AI INTENT] JSON parse error:', parseError)
      }
    }

    console.warn('[AI INTENT] No valid JSON found in response:', text)
    return { type: 'feature_request', intent: 'auth_basic', geminiRaw: text }
  } catch (error) {
    console.warn('[AI INTENT] Gemini API error, using fallback. Error:', error.message)
    return { type: 'feature_request', intent: 'auth_basic', geminiRaw: 'Error: ' + error.message }
  }
}

// Intent별 패키지 매핑 (간소화 버전)
const INTENT_PACKAGES = {
  auth_basic: [
    {
      id: 'firebase_auth',
      name: 'firebase_auth',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/firebase_auth',
      description_ko: 'Firebase에서 제공하는 강력한 인증 솔루션',
      difficulty: '쉬움',
      setup_time: '15-30분',
      pros: ['설정이 간단하고 빠름', '이메일, 전화번호, 소셜 로그인 모두 지원', '무료로 시작 가능'],
      cons: ['Firebase에 종속됨', '커스터마이징 제한적'],
      best_for: ['빠르게 프로토타입 만들기', '백엔드 개발 없이 시작하기'],
      example_code: 'final userCredential = await FirebaseAuth.instance.signInWithEmailAndPassword(email: email, password: password);',
    },
    {
      id: 'flutter_secure_storage',
      name: 'flutter_secure_storage',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/flutter_secure_storage',
      description_ko: '토큰, 비밀번호 등 민감한 데이터를 안전하게 저장',
      difficulty: '쉬움',
      setup_time: '5-10분',
      pros: ['iOS Keychain, Android Keystore 사용', '암호화된 저장소', '사용법이 매우 간단'],
      cons: ['인증 기능 자체는 없음 (저장소만)'],
      best_for: ['JWT 토큰 저장', '사용자 인증 정보 보관'],
      example_code: 'final storage = FlutterSecureStorage(); await storage.write(key: "token", value: myToken);',
    },
  ],
  auth_social: [
    {
      id: 'google_sign_in',
      name: 'google_sign_in',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/google_sign_in',
      description_ko: 'Google 계정으로 간편하게 로그인',
      difficulty: '쉬움',
      setup_time: '20-30분',
      pros: ['전 세계적으로 많이 사용', 'Firebase Auth와 연동 가능'],
      best_for: ['글로벌 앱 개발', '빠른 회원가입'],
    },
    {
      id: 'kakao_flutter_sdk',
      name: 'kakao_flutter_sdk',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/kakao_flutter_sdk',
      description_ko: '카카오톡 계정으로 간편 로그인 (한국 1위)',
      difficulty: '보통',
      setup_time: '25-35분',
      pros: ['한국 사용률 1위', '카카오톡 앱 전환 로그인'],
      best_for: ['한국 타겟 앱 (필수)', '젊은 사용자층'],
    },
  ],
  auth_quick_start: [
    {
      id: 'firebase_auth',
      name: 'firebase_auth',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/firebase_auth',
      description_ko: 'Firebase에서 제공하는 강력한 인증 솔루션',
      difficulty: '쉬움',
      setup_time: '15-30분',
      best_for: ['빠르게 프로토타입 만들기', 'MVP 개발'],
    },
  ],
  auth_korea: [
    {
      id: 'kakao_flutter_sdk',
      name: 'kakao_flutter_sdk',
      description_ko: '카카오톡 계정으로 간편 로그인 (한국 1위)',
      pub_url: 'https://pub.dev/packages/kakao_flutter_sdk',
      best_for: ['한국 타겟 앱'],
    },
    {
      id: 'flutter_naver_login',
      name: 'flutter_naver_login',
      description_ko: '네이버 계정으로 한국 사용자 로그인',
      pub_url: 'https://pub.dev/packages/flutter_naver_login',
      best_for: ['한국 타겟 앱'],
    },
  ],
  auth_secure: [
    {
      id: 'firebase_auth',
      name: 'firebase_auth',
      description_ko: 'Firebase 인증',
      pub_url: 'https://pub.dev/packages/firebase_auth',
    },
    {
      id: 'flutter_secure_storage',
      name: 'flutter_secure_storage',
      description_ko: '안전한 토큰 저장',
      pub_url: 'https://pub.dev/packages/flutter_secure_storage',
    },
  ],
  auth_custom: [
    {
      id: 'flutter_secure_storage',
      name: 'flutter_secure_storage',
      description_ko: 'JWT 토큰 안전 저장',
      pub_url: 'https://pub.dev/packages/flutter_secure_storage',
    },
  ],
  map: [
    {
      id: 'flutter_map',
      name: 'flutter_map',
      description_ko: 'Flutter용 오픈소스 지도 라이브러리',
      pub_url: 'https://pub.dev/packages/flutter_map',
    },
  ],
}

export async function handler(event) {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  try {
    const { message } = JSON.parse(event.body || '{}')

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' }),
      }
    }

    // Gemini로 분류
    const classification = await callGeminiClassifier(message)
    const { type, intent, geminiRaw } = classification

    console.log('[AI INTENT]', { message, type, intent })

    // 패키지 가져오기
    const packages = INTENT_PACKAGES[intent] || []

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        type,
        intent,
        source: 'ai',
        packages,
        geminiRaw, // Gemini 원본 응답 추가
      }),
    }
  } catch (error) {
    console.error('Error:', error)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        type: 'feature_request',
        intent: 'auth_basic',
        source: 'fallback',
        packages: INTENT_PACKAGES.auth_basic || [],
      }),
    }
  }
}
