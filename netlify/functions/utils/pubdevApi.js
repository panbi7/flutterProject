// 내장 fetch 사용 (Node.js 18+)

/**
 * pub.dev API에서 패키지 기본 정보를 가져옵니다.
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
export async function getPackageInfo(packageName) {
  try {
    const url = `https://pub.dev/api/packages/${packageName}`;
    const response = await fetch(url);

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
