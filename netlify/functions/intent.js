import { ALLOWED_INTENTS, ALLOWED_TYPES } from './utils/constants.js'
import { callGeminiClassifier } from './utils/gemini.js'
import { getPackagesByIntent } from './utils/data.js'

export async function handler(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { message } = JSON.parse(event.body || '{}')
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      }
    }

    const classification = await callGeminiClassifier(message)
    let { type, intent, packageName } = classification
    const { geminiRaw } = classification
    const source = 'ai'

    // Keywords to force specific intents
    const lowerMsg = message.toLowerCase()
    if (lowerMsg.includes('google') || lowerMsg.includes('구글')) {
      intent = 'auth_social'
    } else if (lowerMsg.includes('kakao') || lowerMsg.includes('카카오')) {
      intent = 'auth_korea'
    } else if (lowerMsg.includes('naver') || lowerMsg.includes('네이버')) {
      intent = 'auth_social'
    } else if (lowerMsg.includes('apple') || lowerMsg.includes('애플')) {
      intent = 'auth_social'
    } else if (lowerMsg.includes('map') || lowerMsg.includes('지도')) {
      intent = 'map'
    }

    const normalized = normalizeClassification({ type, intent, packageName })
    type = normalized.type
    intent = normalized.intent
    packageName = normalized.packageName

    // feature_request 타입 처리 시 패키지 정렬 로직 추가
    if (type === 'feature_request') {
      let packages = await getPackagesByIntent(intent)

      // 입력 메시지에 포함된 단어와 가장 일치하는 패키지를 최상단으로 정렬
      packages = packages.sort((a, b) => {
        const aMatch = lowerMsg.includes(a.id.toLowerCase()) || lowerMsg.includes(a.name.toLowerCase())
        const bMatch = lowerMsg.includes(b.id.toLowerCase()) || lowerMsg.includes(b.name.toLowerCase())
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
        return 0
      })

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type,
          intent,
          source,
          packages,
          geminiRaw,
          status: { ai: 'connected', data: 'ready' }
        })
      }
    }

    // package_query 타입 처리 (이 부분은 early return 하지 않고 계속 진행하게 두거나, 필요한 경우에만 return)
    if (type === 'package_query' && packageName) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type,
          intent,
          packageName,
          source,
          packages: [{ id: packageName, name: packageName, description: `가이드 보기: ${packageName}` }],
          geminiRaw,
          status: { ai: 'connected', data: 'ready' }
        })
      }
    }

    // 그 외 타입 처리 (smalltalk, clarify 등)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        type: type || 'clarify',
        intent: intent || 'auth_basic',
        source,
        packages: [],
        geminiRaw,
        status: {
          ai: classification.source === 'fallback_error' ? 'error' : 'connected',
          data: 'ready'
        }
      })
    }
  } catch (error) {
    console.error('Error in intent function:', error)
    // Fallback 로직
    try {
      const fallbackIntent = 'auth_basic'
      const packages = await getPackagesByIntent(fallbackIntent)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type: 'feature_request',
          intent: fallbackIntent,
          source: 'fallback_error',
          packages,
          status: {
            ai: 'error',
            data: 'fallback'
          }
        })
      }
    } catch (fallbackError) {
      console.error('Error during fallback:', fallbackError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error during fallback' })
      }
    }
  }
}

function normalizeClassification(raw) {
  const typeCandidate = typeof raw?.type === 'string' ? raw.type.trim() : ''
  const intentCandidate = typeof raw?.intent === 'string' ? raw.intent.trim() : ''
  const packageNameCandidate = typeof raw?.packageName === 'string' ? raw.packageName.trim() : ''

  const type = ALLOWED_TYPES.includes(typeCandidate) ? typeCandidate : 'clarify'
  const intent = ALLOWED_INTENTS.includes(intentCandidate) ? intentCandidate : 'auth_basic'

  const result = { type, intent }
  if (type === 'package_query' && packageNameCandidate) {
    result.packageName = packageNameCandidate
  }

  return result
}
