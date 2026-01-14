import { ALLOWED_INTENTS, ALLOWED_TYPES } from './utils/constants.js'
import { callGeminiClassifier } from './utils/gemini.js'
import { getPackagesByIntent } from './utils/data.js'
import { searchPackages } from './utils/pubdevApi.js'
import { getLocalPackageInfo } from './utils/localPackageInfo.js'

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

    // feature_request 타입 처리 (로컬 DB + 실시간 검색 결합)
    if (type === 'feature_request') {
      let curatedPackages = []
      try {
        curatedPackages = await getPackagesByIntent(intent)
      } catch (e) {
        console.warn(`[Local DB] 인텐트 데이터 로드 실패 (${intent}):`, e.message)
      }

      // 실시간 검색 시도 (로컬에 데이터가 적거나, 범용적인 질문인 경우)
      let searchedPackages = []
      const shouldSearchOnline = curatedPackages.length < 3 || intent === 'auth_basic' || lowerMsg.length > 5

      if (shouldSearchOnline) {
        console.log(`[pub.dev Search] 실시간 검색 수행: ${message}`)
        searchedPackages = await searchPackages(message)
      }

      // 두 결과 통합 및 중복 제거 (ID 기준)
      const combined = [...curatedPackages]
      const curatedIds = new Set(curatedPackages.map(p => p.id))

      for (const p of searchedPackages) {
        if (!curatedIds.has(p.id)) {
          combined.push(p)
        }
      }

      // 입력 메시지 키워드 매칭도에 따른 정렬
      const finalPackages = combined.sort((a, b) => {
        const aMatch = lowerMsg.includes(a.id.toLowerCase()) || (a.name && lowerMsg.includes(a.name.toLowerCase()))
        const bMatch = lowerMsg.includes(b.id.toLowerCase()) || (b.name && lowerMsg.includes(b.name.toLowerCase()))
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
        return 0
      }).slice(0, 10) // 최대 10개만 반환

      // 데이터 보강 (Enrichment)
      const enrichedPackages = await Promise.all(finalPackages.map(async (p) => {
        const localInfo = await getLocalPackageInfo(p.id);
        if (localInfo) {
          return {
            ...p,
            score: localInfo.score,
            githubInfo: localInfo.githubInfo,
            apiTags: localInfo.apiTags,
            maintenance: localInfo.maintenance,
            description: localInfo.description || p.description,
            tags: localInfo.tags
          };
        }
        return p;
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type,
          intent,
          source: searchedPackages.length > 0 ? 'hybrid' : 'ai',
          packages: enrichedPackages,
          geminiRaw,
          status: { ai: 'connected', data: 'ready' }
        })
      }
    }


    // package_query 타입 처리
    if (type === 'package_query' && packageName) {
      const localInfo = await getLocalPackageInfo(packageName);
      const packageData = { id: packageName, name: packageName, description: `가이드 보기: ${packageName}` };

      if (localInfo) {
        Object.assign(packageData, {
          score: localInfo.score,
          githubInfo: localInfo.githubInfo,
          apiTags: localInfo.apiTags,
          maintenance: localInfo.maintenance,
          description: localInfo.description || packageData.description,
          tags: localInfo.tags
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          type,
          intent,
          packageName,
          source,
          packages: [packageData],
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
