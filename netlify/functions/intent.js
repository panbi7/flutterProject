import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

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
  const prompt =
  `너는 Flutter 도우미다. 사용자의 문장을 정확하게 분류해야 한다.

**중요: type을 먼저 정확히 판단하라!**

**type 분류 (최우선):**
1. smalltalk: 인사, 감사, 잡담 (예: "안녕", "고마워", "반가워")
2. feature_request: 구체적인 Flutter 기능/패키지 요청
3. followup_question: 추천받은 기능에 대한 추가 질문
4. clarify: 모호하거나 이해할 수 없는 질문

**intent 분류 (type 결정 후):**
- auth_quick_start: 빠른 시작 원함
- auth_korea: 한국 타겟 (카카오, 네이버)
- auth_social: 소셜 로그인 (구글, 애플)
- auth_secure: 보안 중시
- auth_custom: 커스텀 백엔드/JWT
- auth_basic: 일반 로그인
- map: 지도 관련

**중요 규칙:**
- 인사말은 ALWAYS type: "smalltalk"
- 기능 요청만 type: "feature_request"

**예시 (반드시 참고):**
인사/잡담:
- "안녕" → {"type":"smalltalk","intent":"auth_basic"}
- "안녕하세요" → {"type":"smalltalk","intent":"auth_basic"}
- "고마워" → {"type":"smalltalk","intent":"auth_basic"}
- "반가워요" → {"type":"smalltalk","intent":"auth_basic"}

기능 요청:
- "카카오톡으로 로그인하고 싶어" → {"type":"feature_request","intent":"auth_korea"}
- "빠르게 로그인 만들어줘" → {"type":"feature_request","intent":"auth_quick_start"}
- "구글 로그인 붙이고 싶어" → {"type":"feature_request","intent":"auth_social"}
- "지도 보여주고 싶어" → {"type":"feature_request","intent":"map"}

추가 질문:
- "어떻게 설치해?" → {"type":"followup_question","intent":"auth_basic"}

모호한 질문:
- "뭐" → {"type":"clarify","intent":"auth_basic"}

사용자 문장: "${userMessage}"

출력은 JSON만 반환 (설명 없이):`

  try {
    initializeGemini()

    if (!model) {
      console.warn('[AI INTENT] Gemini API key not configured, using fallback')
      return { type: 'feature_request', intent: 'auth_basic' }
    }

    const result = await model.generateContent(prompt)
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
        return { type: validType, intent: validIntent }
      } catch (parseError) {
        console.warn('[AI INTENT] JSON parse error:', parseError)
      }
    }

    console.warn('[AI INTENT] No valid JSON found in response:', text)
    return { type: 'feature_request', intent: 'auth_basic' }
  } catch (error) {
    console.warn('[AI INTENT] Gemini API error, using fallback. Error:', error.message)
    return { type: 'feature_request', intent: 'auth_basic' }
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

export async function handler(event, context) {
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
    const { type, intent } = classification

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
