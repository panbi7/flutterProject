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
    let classification = null
    let source = 'fallback'

    try {
      classification = await callGeminiClassifier(message)
      source = 'ai'
      console.log('[AI INTENT]', { message, ...classification })

      const { geminiRaw } = classification
      classification = normalizeClassification(classification, { source })
      const { type, intent } = classification

      if (type !== 'feature_request') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            type: type || 'clarify',
            intent: intent || 'auth_basic',
            source,
            packages: [],
            geminiRaw
          })
        }
      }

      const packages = await getPackagesByIntent(intent)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ type, intent, source, packages, geminiRaw })
      }
    } catch (err) {
      console.error('Error handling intent:', err)
      try {
        const fallbackIntent = 'auth_basic'
        const packages = await getPackagesByIntent(fallbackIntent)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            type: 'feature_request',
            intent: fallbackIntent,
            source: 'fallback',
            packages
          })
        }
      } catch (innerErr) {
        console.error('Error during fallback:', innerErr)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            type: 'feature_request',
            intent: 'auth_basic',
            source: 'fallback',
            packages: []
          })
        }
      }
    }
  } catch (error) {
    console.error('Error in intent function:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

function normalizeClassification(raw, { source } = {}) {
  const defaultType = source === 'rule' ? 'feature_request' : 'clarify'
  const typeCandidate = typeof raw?.type === 'string' ? raw.type.trim() : ''
  const intentCandidate = typeof raw?.intent === 'string' ? raw.intent.trim() : ''

  const type = ALLOWED_TYPES.includes(typeCandidate) ? typeCandidate : defaultType
  const intent = ALLOWED_INTENTS.includes(intentCandidate) ? intentCandidate : 'auth_basic'

  return { type, intent }
}
