import express from 'express'
import cors from 'cors'

import { PORT, ALLOWED_INTENTS, ALLOWED_TYPES } from './utils/constants.js'
import { callGeminiClassifier } from './utils/gemini.js'
import { getPackagesByIntent } from './utils/data.js'

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/intent', async (req, res) => {
  const { message } = req.body || {}
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
      return res.status(200).json({ type: type || 'clarify', intent: intent || 'auth_basic', source, packages: [], geminiRaw })
    }

    const packages = await getPackagesByIntent(intent)
    return res.status(200).json({ type, intent, source, packages, geminiRaw })
  } catch (err) {
    console.error('Error handling /api/intent:', err)
    try {
      const fallbackIntent = 'auth_basic'
      const packages = await getPackagesByIntent(fallbackIntent)
      return res.status(200).json({ type: 'feature_request', intent: fallbackIntent, source: 'fallback', packages })
    } catch (innerErr) {
      console.error('Error during fallback:', innerErr)
      return res.status(200).json({ type: 'feature_request', intent: 'auth_basic', source: 'fallback', packages: [] })
    }
  }
})

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})

function normalizeClassification(raw, { source } = {}) {
  const defaultType = source === 'rule' ? 'feature_request' : 'clarify'
  const typeCandidate = typeof raw?.type === 'string' ? raw.type.trim() : ''
  const intentCandidate = typeof raw?.intent === 'string' ? raw.intent.trim() : ''

  const type = ALLOWED_TYPES.includes(typeCandidate) ? typeCandidate : defaultType
  const intent = ALLOWED_INTENTS.includes(intentCandidate) ? intentCandidate : 'auth_basic'

  return { type, intent }
}
