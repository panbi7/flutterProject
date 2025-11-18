import { OLLAMA_MODEL, OLLAMA_URL, ALLOWED_INTENTS, ALLOWED_TYPES } from './constants.js'

export async function callOllamaClassifier(userMessage) {
  const prompt = 
  `너는 Flutter 도우미다.
  \n다음 규칙에 따라 사용자의 문장을 분류하라.
  \n- type: feature_request (Flutter 기능 구현/패키지 추천이 필요한 질문), followup_question (이미 추천한 기능에 대한 추가 질문), smalltalk (인사/잡담), clarify (모호하거나 추가 정보가 필요한 경우) 중 하나만 고른다.
  \n- intent: auth_basic, auth_social, map 중 하나만 고른다. type이 feature_request가 아니어도 가장 관련 있는 intent를 선택한다.
  \n출력은 JSON 한 줄만 반환하라. 예: {"type":"feature_request","intent":"auth_social"}
  \n\n사용자 문장: "${userMessage}"`

  const body = {
    model: OLLAMA_MODEL,
    prompt,
    stream: true,
    options: { temperature: 0 },
  }

  let res
  try {
    res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.warn('[AI INTENT] Ollama not reachable, using fallback. Error:', e.message)
    return { type: 'feature_request', intent: 'auth_basic' }
  }

  if (!res.ok || !res.body) {
    console.warn('[AI INTENT] Ollama HTTP error:', res.status)
    return { type: 'feature_request', intent: 'auth_basic' }
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let aggregated = ''

  if (typeof res.body.getReader === 'function') {
    const reader = res.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      let idx
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)
          if (obj.response) aggregated += obj.response
        } catch {}
      }
    }
  } else {
    await new Promise((resolve, reject) => {
      res.body.on('data', (chunk) => {
        const str = chunk.toString()
        buffer += str
        let idx
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 1)
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line)
            if (obj.response) aggregated += obj.response
          } catch {}
        }
      })
      res.body.on('end', resolve)
      res.body.on('error', reject)
    })
  }

  const match = aggregated.match(/\{[^}]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      const type = parsed.type && String(parsed.type).trim()
      const intent = parsed.intent && String(parsed.intent).trim()
      const validType = ALLOWED_TYPES.includes(type) ? type : 'clarify'
      const validIntent = ALLOWED_INTENTS.includes(intent) ? intent : 'auth_basic'
      return { type: validType, intent: validIntent }
    } catch {}
  }
  return { type: 'feature_request', intent: 'auth_basic' }
}
