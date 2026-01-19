/**
 * 데이터 갱신 Scheduled Function
 * Netlify에서 1시간마다 자동 실행되어 pub.dev 데이터를 갱신
 *
 * 사용법: netlify.toml에 스케줄 설정 추가
 */

import { getPackageInfo, getPackageScore } from './utils/pubdevApi.js'
import { getStore } from '@netlify/blobs'

// 갱신할 인기 패키지 목록 (핵심 패키지만)
const CORE_PACKAGES = [
  'http', 'dio', 'provider', 'riverpod', 'bloc', 'get',
  'firebase_core', 'firebase_auth', 'cloud_firestore',
  'google_maps_flutter', 'flutter_map', 'geolocator',
  'shared_preferences', 'hive', 'sqflite', 'drift',
  'image_picker', 'camera', 'video_player', 'audioplayers',
  'flutter_local_notifications', 'permission_handler',
  'url_launcher', 'share_plus', 'path_provider',
  'cached_network_image', 'flutter_svg', 'lottie',
  'go_router', 'auto_route', 'animations',
  'intl', 'freezed', 'json_serializable',
  'google_sign_in', 'sign_in_with_apple', 'flutter_facebook_auth',
  'supabase_flutter', 'appwrite'
]

async function fetchPackageData(packageName) {
  try {
    const [info, score] = await Promise.all([
      getPackageInfo(packageName),
      getPackageScore(packageName)
    ])

    if (!info) return null

    return {
      packageName: packageName,
      description: info.description,
      url: `https://pub.dev/packages/${packageName}`,
      version: info.version,
      score: {
        likes: score?.likeCount || 0,
        pubPoints: score?.grantedPoints || 0,
        maxPoints: score?.maxPoints || 0,
        popularityScore: score?.popularityScore || 0
      },
      homepage: info.homepage,
      repository: info.repository,
      lastFetched: new Date().toISOString()
    }
  } catch (error) {
    console.error(`[REFRESH] ${packageName} 데이터 가져오기 실패:`, error.message)
    return null
  }
}

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  // 수동 트리거 또는 스케줄 트리거 모두 처리
  console.log('[REFRESH] 데이터 갱신 시작...')

  try {
    // Netlify Blobs 스토어 가져오기
    const store = getStore('package-cache')

    // 병렬로 패키지 데이터 가져오기 (5개씩 배치)
    const results = []
    const batchSize = 5

    for (let i = 0; i < CORE_PACKAGES.length; i += batchSize) {
      const batch = CORE_PACKAGES.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(pkg => fetchPackageData(pkg))
      )
      results.push(...batchResults.filter(r => r !== null))

      // Rate limiting: 배치 사이에 잠시 대기
      if (i + batchSize < CORE_PACKAGES.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // 결과를 Blobs에 저장
    const cacheData = {
      packages: results,
      lastUpdated: new Date().toISOString(),
      count: results.length
    }

    await store.setJSON('live-packages', cacheData)

    console.log(`[REFRESH] ${results.length}개 패키지 데이터 갱신 완료`)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${results.length}개 패키지 데이터 갱신 완료`,
        lastUpdated: cacheData.lastUpdated
      })
    }
  } catch (error) {
    console.error('[REFRESH] 오류:', error)

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    }
  }
}

// Netlify Scheduled Function 설정
export const config = {
  schedule: '@hourly' // 매시간 실행
}
