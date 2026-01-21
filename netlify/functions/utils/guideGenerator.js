import { callGeminiForGuide } from './gemini.js';
import fs from 'fs';
import path from 'path';

// Netlify Functions 환경 감지 및 경로 설정
const isNetlify = !!process.env.LAMBDA_TASK_ROOT;

function getExamplesBundlePath() {
  // Netlify Functions 환경
  if (isNetlify) {
    // esbuild 번들링 후 경로: /var/task/netlify/functions/data/examples.json
    return path.join(process.env.LAMBDA_TASK_ROOT, 'netlify', 'functions', 'data', 'examples.json');
  }
  // 로컬 개발 환경
  return path.join(process.cwd(), 'netlify', 'functions', 'data', 'examples.json');
}

// 캐시
let cachedPackages = null;
let cachedExamples = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 미리 생성된 가이드 JSON을 로드합니다
 */
async function loadPreGeneratedGuide(packageName) {
  try {
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

    // netlify/functions/data/examples/{package}.json 경로
    // 빌드 시 이 폴더도 복사되어야 함
    const guideUrl = `${baseUrl}/guides/${packageName}.json`;

    console.log(`[Guide Generator] 미리 생성된 가이드 확인: ${guideUrl}`);

    const response = await fetch(guideUrl, {
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      const guide = await response.json();
      console.log(`[Guide Generator] ✅ 미리 생성된 가이드 발견: ${packageName}`);
      return guide;
    }

    return null;
  } catch (error) {
    console.log(`[Guide Generator] 미리 생성된 가이드 없음: ${packageName}`);
    return null;
  }
}

/**
 * 패키지 기본 정보를 로드합니다
 */
async function loadPackagesData() {
  const now = Date.now();

  if (cachedPackages && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPackages;
  }

  try {
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const dataUrl = `${baseUrl}/data/packages-lite.json`;

    const response = await fetch(dataUrl, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch packages: ${response.status}`);
    }

    const data = await response.json();
    cachedPackages = data.packages || [];
    cacheTimestamp = now;

    return cachedPackages;
  } catch (error) {
    console.error(`[Guide Generator] 패키지 로드 실패:`, error.message);
    return cachedPackages || [];
  }
}

/**
 * Example 번들 로드 (캐싱)
 */
function loadExamplesBundle() {
  if (cachedExamples) {
    return cachedExamples;
  }

  const bundlePath = getExamplesBundlePath();
  console.log(`[Guide Generator] Example 번들 경로: ${bundlePath}`);

  try {
    if (fs.existsSync(bundlePath)) {
      const content = fs.readFileSync(bundlePath, 'utf-8');
      cachedExamples = JSON.parse(content);
      console.log(`[Guide Generator] ✅ Example 번들 로드 완료: ${Object.keys(cachedExamples).length}개`);
      return cachedExamples;
    }

    console.log(`[Guide Generator] ⚠️ Example 번들 파일 없음: ${bundlePath}`);
    return {};
  } catch (error) {
    console.error(`[Guide Generator] Example 번들 로드 실패:`, error.message);
    return {};
  }
}

/**
 * Example 코드 로드 (번들에서)
 */
async function loadExampleCode(packageName) {
  const examples = loadExamplesBundle();
  const code = examples[packageName];

  if (code) {
    console.log(`[Guide Generator] ✅ Example 발견: ${packageName} (${code.length} bytes)`);
  } else {
    console.log(`[Guide Generator] ⚠️ Example 없음: ${packageName}`);
  }

  return code || null;
}

/**
 * 패키지 이름으로 데이터를 찾습니다
 */
async function findPackageData(packageName) {
  const packages = await loadPackagesData();
  return packages.find(p => p.name === packageName) || null;
}

/**
 * 가이드를 생성합니다
 * 1. 미리 생성된 가이드가 있으면 즉시 반환
 * 2. 없으면 Gemini로 실시간 생성
 */
export async function generateGuideFromPubDev(packageName) {
  console.log(`[Guide Generator] 시작: ${packageName}`);

  // 1. 미리 생성된 가이드 확인
  const preGenerated = await loadPreGeneratedGuide(packageName);
  if (preGenerated) {
    return { ...preGenerated, source: 'pre-generated' };
  }

  // 2. 패키지 정보 확인
  const pkgData = await findPackageData(packageName);

  if (!pkgData) {
    console.warn(`[Guide Generator] 패키지를 찾을 수 없음: ${packageName}`);
    return null;
  }

  // 3. Example 코드 로드
  const exampleCode = await loadExampleCode(packageName);

  console.log(`[Guide Generator] 실시간 생성:`, {
    name: pkgData.name,
    version: pkgData.version,
    hasExample: !!exampleCode
  });

  // 4. Gemini 프롬프트 (간소화 버전)
  const exampleSnippet = exampleCode ? `\n예제:\n${exampleCode.substring(0, 2000)}` : '';

  const prompt = `Flutter 전문가로서 ${pkgData.name} 패키지의 구현 가이드를 JSON으로 작성하세요.

패키지: ${pkgData.name} v${pkgData.version}
설명: ${pkgData.description}
플랫폼: ${(pkgData.platforms || []).join(', ')}${exampleSnippet}

JSON 형식 (마크다운 없이):
{
  "packageId": "${pkgData.name}",
  "title": "${pkgData.name} 구현 가이드",
  "description": "간단한 설명",
  "difficulty": "초급/중급/고급",
  "estimatedTime": "예상 시간",
  "prerequisites": ["준비사항"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "단계 제목",
      "description": "설명",
      "code": { "language": "dart", "filename": "파일명", "content": "코드" },
      "command": "명령어 (선택)",
      "note": "참고 (선택)"
    }
  ],
  "commonErrors": [{ "error": "에러", "solution": "해결" }],
  "tips": ["팁1", "팁2"],
  "references": [{ "title": "공식 문서", "url": "https://pub.dev/packages/${pkgData.name}" }]
}

한국어로 작성하고, 핵심 단계 4-5개를 포함하세요.`;

  try {
    console.log(`[Guide Generator] Gemini API 호출...`);
    const responseText = await callGeminiForGuide(prompt);

    if (!responseText) {
      throw new Error('Gemini 빈 응답');
    }

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const guide = JSON.parse(cleanJson);
      return { ...guide, source: 'generated' };
    } catch (parseError) {
      return {
        packageId: pkgData.name,
        title: `${pkgData.name} 구현 가이드`,
        description: pkgData.description,
        plainText: responseText,
        source: 'generated-fallback'
      };
    }
  } catch (error) {
    console.error(`[Guide Generator] 에러 (${packageName}):`, error.message);
    throw error;
  }
}
