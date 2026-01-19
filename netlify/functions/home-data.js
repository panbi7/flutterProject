/**
 * 홈페이지 데이터 API (pub.dev 실시간 연동)
 *
 * pub.dev API에서 제공하는 정보만 사용:
 * - likeCount (likes)
 * - grantedPoints (pubPoints)
 * - popularityScore
 * - description, version, published 등
 */

// pub.dev API에서 인기 패키지 검색
async function searchPopularPackages(sort = 'like', page = 1) {
  try {
    const url = `https://pub.dev/api/search?q=flutter&sort=${sort}&page=${page}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`pub.dev search API error: ${response.status}`)
    const data = await response.json()
    return data.packages || []
  } catch (error) {
    console.error('[HOME-DATA] searchPopularPackages error:', error.message)
    return []
  }
}

// 패키지 상세 정보 가져오기
async function getPackageDetails(packageName) {
  try {
    const [infoRes, scoreRes] = await Promise.all([
      fetch(`https://pub.dev/api/packages/${packageName}`),
      fetch(`https://pub.dev/api/packages/${packageName}/score`)
    ])

    if (!infoRes.ok) return null

    const info = await infoRes.json()
    const score = scoreRes.ok ? await scoreRes.json() : null
    const latest = info.latest

    return {
      packageName: info.name,
      description: latest?.pubspec?.description || '',
      url: `https://pub.dev/packages/${info.name}`,
      version: latest?.version,
      score: {
        likes: score?.likeCount || 0,
        pubPoints: score?.grantedPoints || 0,
        popularity: Math.round((score?.popularityScore || 0) * 100)
      },
      tags: latest?.pubspec?.topics || [],
      apiTags: extractApiTags(info),
      maintenance: {
        lastUpdated_pub: latest?.published?.split('T')[0] || ''
      }
    }
  } catch (error) {
    console.error(`[HOME-DATA] getPackageDetails error (${packageName}):`, error.message)
    return null
  }
}

// API 태그 추출 (플랫폼 정보)
function extractApiTags(info) {
  const tags = []
  const platforms = info.latest?.pubspec?.platforms
  if (platforms) {
    Object.keys(platforms).forEach(p => tags.push(`platform:${p}`))
  }
  return tags
}

// 여러 패키지 상세 정보 병렬 로드
async function loadPackagesDetails(packageNames, limit = 15) {
  const names = packageNames.slice(0, limit)
  const results = await Promise.all(names.map(name => getPackageDetails(name)))
  return results.filter(p => p !== null)
}

// 인기 패키지 TOP N (likes 기준)
function getTopPackagesByLikes(packages, count = 10) {
  return packages
    .filter(p => p.score?.likes)
    .sort((a, b) => (b.score?.likes || 0) - (a.score?.likes || 0))
    .slice(0, count)
    .map(pkg => ({
      id: pkg.packageName,
      name: pkg.packageName,
      pub_url: pkg.url,
      description: pkg.description,
      likes: pkg.score?.likes || 0,
      pubPoints: pkg.score?.pubPoints || 0,
      popularity: pkg.score?.popularity || 0,
      platforms: extractPlatforms(pkg.apiTags),
      tags: pkg.tags || [],
      lastUpdate: pkg.maintenance?.lastUpdated_pub || ''
    }))
}

// 인기 패키지 TOP N (popularity 기준)
function getTopPackagesByPopularity(packages, count = 10) {
  return packages
    .filter(p => p.score?.popularity)
    .sort((a, b) => (b.score?.popularity || 0) - (a.score?.popularity || 0))
    .slice(0, count)
    .map(pkg => ({
      id: pkg.packageName,
      name: pkg.packageName,
      pub_url: pkg.url,
      description: pkg.description,
      likes: pkg.score?.likes || 0,
      pubPoints: pkg.score?.pubPoints || 0,
      popularity: pkg.score?.popularity || 0,
      platforms: extractPlatforms(pkg.apiTags),
      tags: pkg.tags || [],
      lastUpdate: pkg.maintenance?.lastUpdated_pub || ''
    }))
}

// 최근 업데이트 패키지
function getRecentlyUpdated(packages, count = 6) {
  return packages
    .filter(p => p.maintenance?.lastUpdated_pub)
    .sort((a, b) => {
      const dateA = new Date(a.maintenance?.lastUpdated_pub || 0)
      const dateB = new Date(b.maintenance?.lastUpdated_pub || 0)
      return dateB - dateA
    })
    .slice(0, count)
    .map(pkg => ({
      id: pkg.packageName,
      name: pkg.packageName,
      pub_url: pkg.url,
      description: pkg.description,
      likes: pkg.score?.likes || 0,
      popularity: pkg.score?.popularity || 0,
      lastUpdate: pkg.maintenance?.lastUpdated_pub || '',
      platforms: extractPlatforms(pkg.apiTags),
      tags: pkg.tags || []
    }))
}

// 플랫폼 정보 추출
function extractPlatforms(apiTags) {
  if (!apiTags) return []
  const platforms = []
  if (apiTags.includes('platform:android')) platforms.push('Android')
  if (apiTags.includes('platform:ios')) platforms.push('iOS')
  if (apiTags.includes('platform:web')) platforms.push('Web')
  if (apiTags.includes('platform:macos')) platforms.push('macOS')
  if (apiTags.includes('platform:windows')) platforms.push('Windows')
  if (apiTags.includes('platform:linux')) platforms.push('Linux')
  return platforms
}

// 태그 클라우드 생성
function getTagCloud(packages, limit = 20) {
  const tagCount = {}
  for (const pkg of packages) {
    for (const tag of pkg.tags || []) {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    }
  }
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }))
}

// 통계 정보 계산
function getStats(packages) {
  const totalLikes = packages.reduce((sum, p) => sum + (p.score?.likes || 0), 0)
  const avgPubPoints = packages.length > 0
    ? Math.round(packages.reduce((sum, p) => sum + (p.score?.pubPoints || 0), 0) / packages.length)
    : 0

  return {
    totalPackages: packages.length,
    totalLikes,
    avgPubPoints,
    platforms: getPlatformStats(packages)
  }
}

// 플랫폼별 패키지 수 집계
function getPlatformStats(packages) {
  const stats = { android: 0, ios: 0, web: 0, macos: 0, windows: 0, linux: 0 }
  for (const pkg of packages) {
    const tags = pkg.apiTags || []
    if (tags.includes('platform:android')) stats.android++
    if (tags.includes('platform:ios')) stats.ios++
    if (tags.includes('platform:web')) stats.web++
    if (tags.includes('platform:macos')) stats.macos++
    if (tags.includes('platform:windows')) stats.windows++
    if (tags.includes('platform:linux')) stats.linux++
  }
  return stats
}

// 이달의 위젯 (인기 + 최근 업데이트 조합)
function getMonthlyWidgets(packages, count = 3) {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  const scored = packages.map(pkg => {
    const likes = pkg.score?.likes || 0
    const lastUpdate = pkg.maintenance?.lastUpdated_pub ? new Date(pkg.maintenance.lastUpdated_pub) : new Date(0)
    const recencyBonus = lastUpdate > threeMonthsAgo ? 500 : 0
    const score = likes + recencyBonus
    return { ...pkg, _score: score }
  })

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, count)
    .map(pkg => ({
      id: pkg.packageName,
      name: pkg.packageName,
      pub_url: pkg.url,
      description: pkg.description,
      likes: pkg.score?.likes || 0,
      popularity: pkg.score?.popularity || 0,
      lastUpdate: pkg.maintenance?.lastUpdated_pub || '',
      tags: pkg.tags || [],
      platforms: extractPlatforms(pkg.apiTags)
    }))
}

// 빠른 카테고리 (intent 기반)
function getQuickCategories() {
  return [
    { id: 'auth_basic', label: '로그인/인증', icon: '🔐', color: '#ef4444' },
    { id: 'auth_social', label: '소셜 로그인', icon: '👥', color: '#f97316' },
    { id: 'map', label: '지도', icon: '🗺️', color: '#22c55e' },
    { id: 'firebase', label: 'Firebase', icon: '🔥', color: '#f59e0b' },
    { id: 'storage', label: '저장소/DB', icon: '💾', color: '#3b82f6' },
    { id: 'ui_design', label: 'UI/디자인', icon: '✨', color: '#8b5cf6' },
    { id: 'media', label: '미디어', icon: '🎬', color: '#ec4899' },
    { id: 'network_http', label: '네트워크', icon: '🌐', color: '#06b6d4' },
    { id: 'device', label: '디바이스', icon: '📱', color: '#14b8a6' },
    { id: 'forms', label: '폼/입력', icon: '📝', color: '#84cc16' },
    { id: 'state_management', label: '상태관리', icon: '🔄', color: '#a855f7' },
    { id: 'utils', label: '유틸리티', icon: '🛠️', color: '#64748b' },
  ]
}

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  try {
    console.log('[HOME-DATA] pub.dev 실시간 데이터 요청 시작')

    // pub.dev에서 인기 패키지 검색 (likes 순)
    const popularResults = await searchPopularPackages('like', 1)
    const packageNames = popularResults.map(p => p.package)

    console.log(`[HOME-DATA] 검색된 패키지: ${packageNames.length}개`)

    // 상세 정보 로드 (상위 20개)
    const packages = await loadPackagesDetails(packageNames, 20)

    console.log(`[HOME-DATA] 상세 정보 로드 완료: ${packages.length}개`)

    if (packages.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'pub.dev에서 패키지 데이터를 가져올 수 없습니다' }),
      }
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      source: 'pub.dev-realtime',
      data: {
        monthlyWidgets: getMonthlyWidgets(packages, 3),
        topByLikes: getTopPackagesByLikes(packages, 10),
        topByPopularity: getTopPackagesByPopularity(packages, 10),
        recentlyUpdated: getRecentlyUpdated(packages, 6),
        stats: getStats(packages),
        tagCloud: getTagCloud(packages, 20),
        quickCategories: getQuickCategories(),
      }
    }

    console.log('[HOME-DATA] 실시간 데이터 전송 완료')

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    }
  } catch (error) {
    console.error('[HOME-DATA] 오류:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    }
  }
}
