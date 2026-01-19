/**
 * 홈페이지 데이터 API
 * - 이달의 위젯 (동적)
 * - 인기 패키지 TOP 10
 * - 최근 업데이트 패키지
 * - 통계 정보
 * - 태그/카테고리 정보
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)) }
  catch (e) { return typeof __dirname !== 'undefined' ? __dirname : process.cwd() }
})()

// top_packages.json 로드
async function loadTopPackages() {
  const possiblePaths = [
    path.join(_dirname, 'data', 'top_packages.json'),
    path.join(process.cwd(), 'netlify/functions/data/top_packages.json'),
    path.join(process.env.LAMBDA_TASK_ROOT || '', 'netlify/functions/data/top_packages.json'),
  ]

  for (const p of possiblePaths) {
    try {
      const data = await fs.readFile(p, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      continue
    }
  }

  console.warn('[HOME-DATA] top_packages.json을 찾을 수 없습니다')
  return []
}

// 이달의 위젯 선택 (likes + 최근 업데이트 기준)
function getMonthlyWidgets(packages, count = 3) {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  // 최근 업데이트 + 높은 likes 조합으로 점수 계산
  const scored = packages.map(pkg => {
    const likes = pkg.score?.likes || 0
    const lastCommit = pkg.githubInfo?.lastCommit ? new Date(pkg.githubInfo.lastCommit) : new Date(0)
    const lastPubUpdate = pkg.maintenance?.lastUpdated_pub ? new Date(pkg.maintenance.lastUpdated_pub) : new Date(0)
    const latestUpdate = new Date(Math.max(lastCommit.getTime(), lastPubUpdate.getTime()))

    // 최근 3개월 내 업데이트면 보너스
    const recencyBonus = latestUpdate > threeMonthsAgo ? 1000 : 0
    const score = likes + recencyBonus + (pkg.githubInfo?.stars || 0) * 0.5

    return { ...pkg, _score: score, _latestUpdate: latestUpdate }
  })

  // Flutter Favorite 또는 높은 점수 우선
  const sorted = scored.sort((a, b) => {
    const aFav = a.apiTags?.includes('is:flutter-favorite') ? 1 : 0
    const bFav = b.apiTags?.includes('is:flutter-favorite') ? 1 : 0
    if (aFav !== bFav) return bFav - aFav
    return b._score - a._score
  })

  // 다양한 카테고리에서 선택 (중복 방지)
  const selected = []
  const usedCategories = new Set()

  for (const pkg of sorted) {
    if (selected.length >= count) break

    const category = pkg.tags?.[0] || 'general'
    if (!usedCategories.has(category) || selected.length < 2) {
      selected.push({
        id: pkg.packageName,
        name: pkg.packageName,
        pub_url: pkg.url,
        description: pkg.description,
        likes: pkg.score?.likes || 0,
        stars: pkg.githubInfo?.stars || 0,
        lastUpdate: pkg.maintenance?.lastUpdated_pub || '',
        tags: pkg.tags || [],
        platforms: extractPlatforms(pkg.apiTags),
        isFlutterFavorite: pkg.apiTags?.includes('is:flutter-favorite') || false
      })
      usedCategories.add(category)
    }
  }

  return selected
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
      stars: pkg.githubInfo?.stars || 0,
      pubPoints: pkg.score?.pubPoints || 0,
      platforms: extractPlatforms(pkg.apiTags),
      tags: pkg.tags || [],
      isFlutterFavorite: pkg.apiTags?.includes('is:flutter-favorite') || false
    }))
}

// GitHub Stars 기준 TOP N
function getTopPackagesByStars(packages, count = 10) {
  return packages
    .filter(p => p.githubInfo?.stars)
    .sort((a, b) => (b.githubInfo?.stars || 0) - (a.githubInfo?.stars || 0))
    .slice(0, count)
    .map(pkg => ({
      id: pkg.packageName,
      name: pkg.packageName,
      pub_url: pkg.url,
      description: pkg.description,
      likes: pkg.score?.likes || 0,
      stars: pkg.githubInfo?.stars || 0,
      pubPoints: pkg.score?.pubPoints || 0,
      platforms: extractPlatforms(pkg.apiTags),
      tags: pkg.tags || [],
      isFlutterFavorite: pkg.apiTags?.includes('is:flutter-favorite') || false
    }))
}

// 최근 업데이트된 패키지
function getRecentlyUpdated(packages, count = 6) {
  return packages
    .filter(p => p.maintenance?.lastUpdated_pub || p.githubInfo?.lastCommit)
    .map(pkg => {
      const pubDate = pkg.maintenance?.lastUpdated_pub ? new Date(pkg.maintenance.lastUpdated_pub) : new Date(0)
      const commitDate = pkg.githubInfo?.lastCommit ? new Date(pkg.githubInfo.lastCommit) : new Date(0)
      const latestDate = new Date(Math.max(pubDate.getTime(), commitDate.getTime()))
      return { ...pkg, _latestDate: latestDate }
    })
    .sort((a, b) => b._latestDate - a._latestDate)
    .slice(0, count)
    .map(pkg => ({
      id: pkg.packageName,
      name: pkg.packageName,
      pub_url: pkg.url,
      description: pkg.description,
      likes: pkg.score?.likes || 0,
      stars: pkg.githubInfo?.stars || 0,
      lastUpdate: pkg._latestDate.toISOString().split('T')[0],
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

// 플랫폼별 패키지 수 집계
function getPlatformStats(packages) {
  const stats = {
    android: 0,
    ios: 0,
    web: 0,
    macos: 0,
    windows: 0,
    linux: 0
  }

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
  const totalStars = packages.reduce((sum, p) => sum + (p.githubInfo?.stars || 0), 0)
  const flutterFavorites = packages.filter(p => p.apiTags?.includes('is:flutter-favorite')).length
  const avgPubPoints = Math.round(
    packages.reduce((sum, p) => sum + (p.score?.pubPoints || 0), 0) / packages.length
  )

  return {
    totalPackages: packages.length,
    totalLikes,
    totalStars,
    flutterFavorites,
    avgPubPoints,
    platforms: getPlatformStats(packages)
  }
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
    console.log('[HOME-DATA] 홈페이지 데이터 요청')

    const packages = await loadTopPackages()

    if (packages.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '패키지 데이터를 로드할 수 없습니다' }),
      }
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        monthlyWidgets: getMonthlyWidgets(packages, 3),
        topByLikes: getTopPackagesByLikes(packages, 10),
        topByStars: getTopPackagesByStars(packages, 10),
        recentlyUpdated: getRecentlyUpdated(packages, 6),
        stats: getStats(packages),
        tagCloud: getTagCloud(packages, 20),
        quickCategories: getQuickCategories(),
      }
    }

    console.log('[HOME-DATA] 데이터 전송 완료')

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
