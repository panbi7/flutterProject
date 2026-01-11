/**
 * pub.dev API 연동 모듈
 * 실시간으로 Flutter 패키지 정보를 가져옵니다
 */

/**
 * pub.dev에서 패키지 정보 가져오기
 * @param {string} packageName - 패키지 이름
 * @returns {Promise<Object|null>} 패키지 정보 또는 null
 */
export async function getPackageFromPubDev(packageName) {
  try {
    console.log(`[PUB.DEV] ${packageName} 패키지 조회 중...`);

    // pub.dev API 호출
    const response = await fetch(`https://pub.dev/api/packages/${packageName}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[PUB.DEV] ${packageName} 패키지를 찾을 수 없습니다.`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`[PUB.DEV] ✅ ${packageName} 정보 가져오기 성공`);

    // 필요한 정보만 추출
    return {
      name: data.name,
      description: data.latest.pubspec.description || '설명 없음',
      version: data.latest.version,
      url: `https://pub.dev/packages/${packageName}`,
      githubUrl: data.latest.pubspec.homepage || data.latest.pubspec.repository || null,
      readme: null, // README는 별도 요청 필요
      pubspec: data.latest.pubspec,
    };
  } catch (error) {
    console.error(`[PUB.DEV] ❌ ${packageName} 조회 실패:`, error.message);
    return null;
  }
}

/**
 * pub.dev에서 패키지 README 가져오기
 * @param {string} packageName - 패키지 이름
 * @returns {Promise<string|null>} README 내용 또는 null
 */
export async function getPackageReadme(packageName) {
  try {
    console.log(`[PUB.DEV] ${packageName} README 조회 중...`);

    // pub.dev README API는 없으므로 페이지 스크래핑 대신
    // pubspec에서 repository URL을 가져와서 GitHub raw 접근
    const packageInfo = await getPackageFromPubDev(packageName);

    if (!packageInfo || !packageInfo.githubUrl) {
      console.log(`[PUB.DEV] ${packageName} GitHub URL을 찾을 수 없습니다.`);
      return null;
    }

    // GitHub README 시도
    const githubUrl = packageInfo.githubUrl;
    const readmeUrl = githubUrl.replace('github.com', 'raw.githubusercontent.com') + '/main/README.md';

    const response = await fetch(readmeUrl);
    if (response.ok) {
      const readme = await response.text();
      console.log(`[PUB.DEV] ✅ ${packageName} README 가져오기 성공`);
      return readme;
    }

    // main 브랜치가 아닌 경우 master 시도
    const masterReadmeUrl = githubUrl.replace('github.com', 'raw.githubusercontent.com') + '/master/README.md';
    const masterResponse = await fetch(masterReadmeUrl);
    if (masterResponse.ok) {
      const readme = await masterResponse.text();
      console.log(`[PUB.DEV] ✅ ${packageName} README 가져오기 성공 (master)`);
      return readme;
    }

    console.log(`[PUB.DEV] ${packageName} README를 찾을 수 없습니다.`);
    return null;
  } catch (error) {
    console.error(`[PUB.DEV] ❌ ${packageName} README 조회 실패:`, error.message);
    return null;
  }
}

/**
 * README에서 예제 코드 추출
 * @param {string} readme - README 내용
 * @returns {string|null} 추출된 예제 코드 또는 null
 */
export function extractExampleFromReadme(readme) {
  if (!readme) return null;

  try {
    // ```dart 또는 ```flutter 코드 블록 찾기
    const codeBlockRegex = /```(?:dart|flutter)\n([\s\S]*?)```/gi;
    const matches = [...readme.matchAll(codeBlockRegex)];

    if (matches.length === 0) {
      // dart/flutter 명시 없는 코드 블록도 시도
      const generalCodeRegex = /```\n([\s\S]*?)```/gi;
      const generalMatches = [...readme.matchAll(generalCodeRegex)];

      if (generalMatches.length > 0) {
        // 첫 번째 코드 블록 반환 (보통 예제가 먼저 나옴)
        return generalMatches[0][1].trim();
      }

      return null;
    }

    // 첫 번째 dart/flutter 코드 블록 반환
    return matches[0][1].trim();
  } catch (error) {
    console.error('[PUB.DEV] 예제 추출 실패:', error.message);
    return null;
  }
}

/**
 * 패키지 정보 + README + 예제를 모두 가져오기
 * @param {string} packageName - 패키지 이름
 * @returns {Promise<Object|null>} 전체 패키지 정보 또는 null
 */
export async function getFullPackageInfo(packageName) {
  try {
    const packageInfo = await getPackageFromPubDev(packageName);

    if (!packageInfo) {
      return null;
    }

    // README 가져오기 (선택적)
    const readme = await getPackageReadme(packageName);
    const exampleCode = readme ? extractExampleFromReadme(readme) : null;

    return {
      ...packageInfo,
      readme,
      exampleCode,
    };
  } catch (error) {
    console.error(`[PUB.DEV] ❌ ${packageName} 전체 정보 조회 실패:`, error.message);
    return null;
  }
}
