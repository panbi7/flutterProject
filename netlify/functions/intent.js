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
    const source = 'ai'
    console.log('[AI INTENT]', { message, ...classification })

    const { geminiRaw } = classification
    const { type, intent, packageName } = normalizeClassification(classification)

    // package_query 타입 처리
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
          status: {
            ai: 'connected',
            data: 'ready'
          }
        })
      }
    }

    // feature_request 타입 처리
    if (type === 'feature_request') {
      const packages = await getPackagesByIntent(intent)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type,
          intent,
          source,
          packages,
          geminiRaw,
          status: {
            ai: 'connected',
            data: 'ready'
          }
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
