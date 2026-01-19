/**
 * 데이터 상태 확인 API
 * top_packages.json의 현재 상태를 반환합니다.
 *
 * 데이터 갱신은 크롤링 스크립트를 수동으로 실행하거나
 * GitHub Actions로 자동화할 수 있습니다.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)) }
  catch (e) { return typeof __dirname !== 'undefined' ? __dirname : process.cwd() }
})()

async function loadTopPackages() {
  const possiblePaths = [
    path.join(_dirname, 'data', 'top_packages.json'),
    path.join(process.cwd(), 'netlify/functions/data/top_packages.json'),
  ]

  for (const p of possiblePaths) {
    try {
      const data = await fs.readFile(p, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      continue
    }
  }
  return []
}

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  try {
    const packages = await loadTopPackages()

    // 간단한 통계
    const totalLikes = packages.reduce((sum, p) => sum + (p.score?.likes || 0), 0)
    const totalStars = packages.reduce((sum, p) => sum + (p.githubInfo?.stars || 0), 0)

    // 가장 최근 업데이트된 패키지 찾기
    const dates = packages
      .map(p => p.maintenance?.lastUpdated_pub || p.githubInfo?.lastCommit)
      .filter(Boolean)
      .sort()
      .reverse()

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'static-data',
        stats: {
          totalPackages: packages.length,
          totalLikes,
          totalStars,
          latestUpdate: dates[0] || 'unknown'
        },
        message: '데이터는 크롤링 스크립트로 갱신됩니다. (test-scrape.js)',
        tip: '자동 갱신을 원하면 GitHub Actions 설정을 추가하세요.'
      })
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    }
  }
}
