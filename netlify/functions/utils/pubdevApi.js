// 내장 fetch 사용 (Node.js 18+)

/**
 * pub.dev API에서 패키지 기본 정보를 가져옵니다.
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
export async function getPackageInfo(packageName) {
  try {
    const url = `https://pub.dev/api/packages/${packageName}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000), // 3초 타임아웃
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[pub.dev API] 패키지를 찾을 수 없음: ${packageName}`);
        return null;
      }
      throw new Error(`pub.dev API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const latest = data.latest;

    return {
      name: data.name,
      version: latest.version,
      description: latest.pubspec.description,
      homepage: latest.pubspec.homepage,
      repository: latest.pubspec.repository,
      published: latest.published
    };
  } catch (error) {
    console.error(`[pub.dev API] getPackageInfo 에러 (${packageName}):`, error.message);
    return null;
  }
}

/**
 * pub.dev API에서 패키지 점수 및 인기도 정보를 가져옵니다.
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
export async function getPackageScore(packageName) {
  try {
    const url = `https://pub.dev/api/packages/${packageName}/score`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`pub.dev Score API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    return {
      grantedPoints: data.grantedPoints,
      maxPoints: data.maxPoints,
      likeCount: data.likeCount,
      popularityScore: data.popularityScore
    };
  } catch (error) {
    console.error(`[pub.dev API] getPackageScore 에러 (${packageName}):`, error.message);
    return null;
  }
}
/**
 * pub.dev에서 키워드로 패키지를 검색합니다.
 * @param {string} query 
 * @returns {Promise<Array>} - 검색 결과 패키지 리스트
 */
export async function searchPackages(query) {
  try {
    const url = `https://pub.dev/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Search API 실패');

    const data = await response.json();
    // 검색 결과에서 상위 5개 정도만 상세 정보 가져오기
    const packageNames = data.packages.slice(0, 5).map(p => p.package);

    const results = await Promise.all(
      packageNames.map(name => getPackageInfo(name))
    );

    return results.filter(p => p !== null).map(p => ({
      id: p.name,
      name: p.name,
      description: p.description,
      pub_url: `https://pub.dev/packages/${p.name}`,
      category: 'search_result'
    }));
  } catch (error) {
    console.error('[pub.dev API] searchPackages 에러:', error.message);
    return [];
  }
}
