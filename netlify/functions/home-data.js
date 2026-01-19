import fetch from 'node-fetch';

const PUB_DEV_API = 'https://pub.dev/api';

/**
 * pub.dev에서 패키지 검색 (페이지네이션 지원)
 */
async function searchPackages(query = '', page = 1, pageSize = 100) {
  try {
    const url = `${PUB_DEV_API}/search?q=${encodeURIComponent(query)}&page=${page}&size=${pageSize}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`pub.dev API error: ${response.status}`);
    }

    const data = await response.json();
    return data.packages || [];
  } catch (error) {
    console.error('Failed to search packages:', error);
    return [];
  }
}

/**
 * 패키지 상세 정보 가져오기
 */
async function getPackageInfo(packageName) {
  try {
    const url = `${PUB_DEV_API}/packages/${packageName}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to get package info for ${packageName}:`, error);
    return null;
  }
}

/**
 * 패키지 점수 정보 가져오기
 */
async function getPackageScore(packageName) {
  try {
    const url = `${PUB_DEV_API}/packages/${packageName}/score`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to get package score for ${packageName}:`, error);
    return null;
  }
}

export async function handler(event) {
  try {
    console.log('[home-data] 홈 데이터 생성 시작');

    // pub.dev에서 인기 패키지 검색 (여러 페이지)
    const allPackages = [];
    const pagesToFetch = 3; // 300개 패키지 (100개 * 3페이지)

    for (let page = 1; page <= pagesToFetch; page++) {
      console.log(`[home-data] 페이지 ${page} 로딩 중...`);
      const packages = await searchPackages('', page, 100);
      allPackages.push(...packages);
    }

    console.log(`[home-data] 총 ${allPackages.length}개 패키지 로드 완료`);

    // 패키지 데이터 가공
    const processedPackages = allPackages.map(pkg => ({
      id: pkg.package,
      name: pkg.package,
      description: pkg.description || 'No description',
      likes: pkg.likeCount || 0,
      popularity: Math.round((pkg.grantedPoints || 0) / 1.6), // pub.dev의 점수를 0-100으로 변환
      pubPoints: pkg.grantedPoints || 0,
      pub_url: `https://pub.dev/packages/${pkg.package}`,
      platforms: pkg.tags?.filter(tag => tag.startsWith('platform:')).map(tag => tag.replace('platform:', '')) || [],
      lastUpdate: 'N/A' // search API에는 업데이트 날짜가 없음
    }));

    // Likes 기준 TOP 10
    const topByLikes = [...processedPackages]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10);

    // Popularity 기준 TOP 10
    const topByPopularity = [...processedPackages]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);

    // 최근 업데이트는 search API에서 제공하지 않으므로 인기 패키지로 대체
    const recentlyUpdated = [...processedPackages].slice(0, 10);

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
    allPackages.forEach(pkg => {
      pkg.tags?.forEach(tag => {
        if (!tag.startsWith('platform:') && !tag.startsWith('sdk:') && !tag.startsWith('is:')) {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        }
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

    console.log('[home-data] 응답 데이터 생성 완료');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // 1시간 캐싱
      },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    console.error('[home-data] Failed to load home data:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to load home data from pub.dev' }),
    };
  }
}