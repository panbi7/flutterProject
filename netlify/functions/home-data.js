import fs from 'fs/promises';
import path from 'path';

// data/top_packages.json 파일의 전체 경로를 올바르게 설정합니다.
const TOP_PACKAGES_PATH = path.resolve(process.cwd(), 'netlify/functions/data/top_packages.json');

export async function handler(event) {
  try {
    const data = await fs.readFile(TOP_PACKAGES_PATH, 'utf-8');
    const packages = JSON.parse(data);

    // 패키지 데이터 가공
    const processedPackages = packages.map(pkg => ({
      id: pkg.packageName,
      name: pkg.packageName,
      description: pkg.description,
      likes: pkg.score?.likes || 0,
      popularity: pkg.score?.popularityScore || 0,
      pubPoints: pkg.score?.pubPoints || 0,
      pub_url: pkg.url,
      platforms: pkg.apiTags?.filter(tag => tag.startsWith('platform:')).map(tag => tag.replace('platform:', '')) || [],
      lastUpdate: pkg.maintenance?.lastUpdated_pub || 'N/A'
    }));

    // Likes 기준 TOP 10
    const topByLikes = processedPackages
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10);

    // Popularity 기준 TOP 10
    const topByPopularity = processedPackages
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);

    // 최근 업데이트 TOP 10
    const recentlyUpdated = processedPackages
      .filter(pkg => pkg.lastUpdate !== 'N/A')
      .sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate))
      .slice(0, 10);

    // 통계 계산
    const totalLikes = processedPackages.reduce((sum, pkg) => sum + pkg.likes, 0);
    const avgPubPoints = Math.round(
      processedPackages.reduce((sum, pkg) => sum + pkg.pubPoints, 0) / processedPackages.length
    );

    // 플랫폼별 통계
    const platformStats = {};
    processedPackages.forEach(pkg => {
      pkg.platforms.forEach(platform => {
        platformStats[platform.toLowerCase()] = (platformStats[platform.toLowerCase()] || 0) + 1;
      });
    });

    // 태그 클라우드 (상위 20개)
    const tagCount = {};
    packages.forEach(pkg => {
      pkg.tags?.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    const tagCloud = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));

    // 빠른 카테고리
    const quickCategories = [
      { id: 'auth', label: '인증', icon: '🔐', color: '#4CAF50' },
      { id: 'ui', label: 'UI/UX', icon: '🎨', color: '#2196F3' },
      { id: 'network', label: '네트워크', icon: '🌐', color: '#FF9800' },
      { id: 'storage', label: '저장소', icon: '💾', color: '#9C27B0' },
      { id: 'media', label: '미디어', icon: '📷', color: '#E91E63' },
      { id: 'device', label: '디바이스', icon: '📱', color: '#00BCD4' },
    ];

    // 응답 데이터 구조
    const responseData = {
      monthlyWidgets: processedPackages.slice(0, 100),
      topByLikes,
      topByPopularity,
      recentlyUpdated,
      stats: {
        totalPackages: processedPackages.length,
        totalLikes,
        avgPubPoints,
        platforms: platformStats
      },
      tagCloud,
      quickCategories
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    console.error('Failed to read top_packages.json:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to load home data.' }),
    };
  }
}