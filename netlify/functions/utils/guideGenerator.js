import { callGeminiForGuide } from './gemini.js';

// 캐시된 패키지 데이터
let cachedPackages = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 패키지 기본 정보를 로드합니다 (lite 버전 - exampleCode 없음)
 */
async function loadPackagesData() {
  const now = Date.now();

  if (cachedPackages && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPackages;
  }

  try {
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const dataUrl = `${baseUrl}/data/packages-lite.json`;

    console.log(`[Guide Generator] Loading packages from: ${dataUrl}`);

    const response = await fetch(dataUrl, {
      signal: AbortSignal.timeout(5000) // 5초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch packages: ${response.status}`);
    }

    const data = await response.json();
    cachedPackages = data.packages || [];
    cacheTimestamp = now;

    console.log(`[Guide Generator] Loaded ${cachedPackages.length} packages`);
    return cachedPackages;
  } catch (error) {
    console.error(`[Guide Generator] Failed to load packages:`, error.message);
    return cachedPackages || [];
  }
}

/**
 * 특정 패키지의 example 코드를 로드합니다
 */
async function loadExampleCode(packageName) {
  try {
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const exampleUrl = `${baseUrl}/data/examples/${packageName}.txt`;

    const response = await fetch(exampleUrl, {
      signal: AbortSignal.timeout(3000) // 3초 타임아웃
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn(`[Guide Generator] Example not found for ${packageName}`);
    return null;
  }
}

/**
 * 패키지 이름으로 데이터를 찾습니다
 */
async function findPackageData(packageName) {
  const packages = await loadPackagesData();
  return packages.find(p => p.name === packageName) || null;
}

/**
 * 로컬 패키지 데이터를 바탕으로 Gemini를 사용하여 구현 가이드를 생성합니다.
 */
export async function generateGuideFromPubDev(packageName) {
  console.log(`[Guide Generator] 시작: ${packageName}`);

  try {
    // 1. 패키지 기본 정보 찾기
    const pkgData = await findPackageData(packageName);

    if (!pkgData) {
      console.warn(`[Guide Generator] 패키지를 찾을 수 없음: ${packageName}`);
      return null;
    }

    // 2. example 코드 로드 (별도 파일)
    const exampleCode = await loadExampleCode(packageName);

    console.log(`[Guide Generator] 패키지 정보:`, {
      name: pkgData.name,
      version: pkgData.version,
      hasExample: !!exampleCode
    });

    // 3. Gemini 프롬프트 구성 (간소화)
    const exampleSnippet = exampleCode ? `\n예제 코드:\n${exampleCode.substring(0, 2000)}` : '';

    const prompt = `Flutter 전문가로서 ${pkgData.name} 패키지의 구현 가이드를 작성해주세요.

패키지: ${pkgData.name} v${pkgData.version}
설명: ${pkgData.description}
플랫폼: ${(pkgData.platforms || []).join(', ')}${exampleSnippet}

아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "title": "${pkgData.name} 구현 가이드",
  "description": "간단한 설명",
  "difficulty": "초급/중급/고급",
  "steps": [
    {
      "stepNumber": 1,
      "title": "단계 제목",
      "description": "설명",
      "code": { "language": "dart", "filename": "파일명", "content": "코드" }
    }
  ],
  "tips": ["팁1", "팁2"],
  "references": [{ "title": "공식 문서", "url": "https://pub.dev/packages/${pkgData.name}" }]
}

한국어로 작성하고, 핵심 단계 3-4개만 포함하세요.`;

    // 4. Gemini로 가이드 생성
    console.log(`[Guide Generator] Gemini API 호출...`);
    const responseText = await callGeminiForGuide(prompt);

    if (!responseText) {
      throw new Error('Gemini 빈 응답');
    }

    console.log(`[Guide Generator] 응답 수신 (${responseText.length} chars)`);

    // JSON 파싱
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const guide = JSON.parse(cleanJson);
      return { ...guide, source: 'generated' };
    } catch (parseError) {
      console.warn(`[Guide Generator] JSON 파싱 실패:`, parseError.message);
      return {
        title: `${pkgData.name} 구현 가이드`,
        description: pkgData.description,
        plainText: responseText,
        source: 'generated'
      };
    }
  } catch (error) {
    console.error(`[Guide Generator] 에러 (${packageName}):`, error.message);
    throw error;
  }
}
