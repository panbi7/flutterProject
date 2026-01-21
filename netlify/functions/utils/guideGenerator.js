import { callGeminiForGuide } from './gemini.js';

// 캐시된 패키지 데이터
let cachedPackages = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 로컬 또는 원격에서 패키지 데이터를 가져옵니다.
 * @returns {Promise<Array>}
 */
async function loadPackagesData() {
  const now = Date.now();

  // 캐시가 유효하면 재사용
  if (cachedPackages && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPackages;
  }

  try {
    // Netlify 배포 환경에서는 사이트 URL에서 fetch
    // 로컬 개발 환경에서는 localhost 사용
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const dataUrl = `${baseUrl}/data/all-packages.json`;

    console.log(`[Guide Generator] Loading packages from: ${dataUrl}`);

    const response = await fetch(dataUrl);
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
    return cachedPackages || []; // 이전 캐시 반환 또는 빈 배열
  }
}

/**
 * 패키지 이름으로 데이터를 찾습니다.
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
async function findPackageData(packageName) {
  const packages = await loadPackagesData();
  return packages.find(p => p.name === packageName) || null;
}

/**
 * 로컬 패키지 데이터를 바탕으로 Gemini를 사용하여 구현 가이드를 생성합니다.
 * @param {string} packageName
 * @returns {Promise<Object|null>}
 */
export async function generateGuideFromPubDev(packageName) {
  console.log(`[Guide Generator] 시작: ${packageName}`);

  try {
    // 1. 로컬 JSON에서 패키지 정보 찾기
    const pkgData = await findPackageData(packageName);

    if (!pkgData) {
      console.warn(`[Guide Generator] 패키지를 찾을 수 없음: ${packageName}`);
      return null;
    }

    console.log(`[Guide Generator] 패키지 정보 로드 완료:`, {
      name: pkgData.name,
      version: pkgData.version,
      hasExample: !!pkgData.exampleCode
    });

    // 2. 예제 코드 준비
    const exampleSnippet = pkgData.exampleCode
      ? `공식 예제 코드:\n${pkgData.exampleCode}`
      : '';

    // 3. Gemini 프롬프트 구성
    const prompt = `
당신은 세계 최고의 Flutter 전문가입니다. 제공된 패키지 정보와 '공식 예제 코드'를 기반으로, 해당 패키지를 실무에 바로 적용할 수 있는 **완벽한 구현 가이드**를 작성하는 것이 임무입니다.

품질 기준:
- 'firebase_auth' 패키지 가이드 수준으로 매우 상세하고 구조적이어야 합니다.
- 단순히 코드를 보여주는 것을 넘어, 왜 이 코드가 필요한지, 어떤 설정이 선행되어야 하는지 친절하게 설명하세요.
- 모든 텍스트(제목, 설명, 팁 등)는 **한국어**로 작성하세요.

패키지 정보:
- 이름: ${pkgData.name}
- 버전: ${pkgData.version}
- 설명: ${pkgData.description}
- 지원 플랫폼: ${(pkgData.platforms || []).join(', ') || '정보 없음'}
${exampleSnippet}

요구사항:
1. 반드시 다음 JSON 구조를 지켜서 응답하세요. (구조가 틀리면 시스템이 작동하지 않습니다.)
2. 마크다운 기호(\`\`\`) 없이 순수 JSON 객체만 반환하세요.
3. [중요] 제공된 정보와 예제 코드를 심층 분석하여, 실제 작동 가능하고 Flutter의 최신 모범 사례(Clean Architecture, Null Safety 등)를 반영한 코드를 포함하세요.
4. 초보자도 따라 할 수 있도록 단계를 1번부터 상세히 나누되, 코드가 너무 길어질 경우 핵심 로직 위주로 작성하여 응답이 중간에 끊기지 않도록 하세요.
5. [중고급자 배려] 가이드의 깊이는 유지하되, 반복되는 보일러플레이트 코드는 생략하거나 주석 처리하여 가독성을 높이세요.

JSON Schema:
{
  "title": "${pkgData.name} 구현 가이드",
  "description": "패키지의 핵심 가치를 설명하는 짧고 명확한 요약",
  "difficulty": "초급/중급/고급 중 선택",
  "estimatedTime": "소요 예상 시간 (예: 20-30분)",
  "prerequisites": ["사전 설치 필요 항목 (예: CocoaPods, API Key)"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "단계 제목",
      "description": "이 단계에서 무엇을 하는지 상세 설명",
      "substeps": ["작은 수행 단위 1", "작은 수행 단위 2"],
      "code": {
        "language": "dart",
        "filename": "lib/main.dart (예시)",
        "content": "실제 코드 내용"
      },
      "command": "터미널 명령어 (필요 시)",
      "commands": ["명령어1", "명령어2"],
      "note": "중요한 주의사항이나 팁",
      "explanation": "코드에 대한 심층 해설"
    }
  ],
  "commonErrors": [
    { "error": "에러 상황", "solution": "해결 방법", "link": "참고 URL (선택)" }
  ],
  "tips": ["전문가용 실무 팁 1", "성능 최적화 팁 2"],
  "nextSteps": [
    { "title": "다음 단계 제목", "description": "다음에 무엇을 공부하면 좋은지", "packageId": "연관 패키지ID (선택)" }
  ],
  "references": [
    { "title": "공식 문서", "url": "https://pub.dev/packages/${pkgData.name}" }
  ]
}

이제 ${pkgData.name}에 대한 완벽한 가이드를 위 JSON 형식으로 작성해주세요.
`;

    // 4. Gemini로 가이드 생성
    console.log(`[Guide Generator] Gemini API 호출 중...`);
    const responseText = await callGeminiForGuide(prompt);

    if (!responseText) {
      throw new Error('Gemini 가이드 생성 실패: 빈 응답');
    }

    console.log(`[Guide Generator] Gemini 응답 수신 (${responseText.length} chars)`);

    try {
      // JSON 응답에서 불필요한 마크다운 기호(```json ... ```) 제거 후 파싱
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const structuredGuide = JSON.parse(cleanJson);

      console.log(`[Guide Generator] JSON 파싱 성공`);
      return {
        ...structuredGuide,
        source: 'generated'
      };
    } catch (parseError) {
      console.warn(`[Guide Generator] JSON 파싱 실패, plainText로 대체:`, parseError.message);
      // 파싱 실패 시 예비용으로 plainText 형태로라도 반환
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
