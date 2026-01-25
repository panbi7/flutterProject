/**
 * 패키지 구현 가이드 생성기
 *
 * all-packages.json의 exampleCode를 활용하여 Gemini로 구조화된 가이드 생성
 */

import { callGeminiForGuide } from './gemini.js';

// 패키지 데이터 캐시
let cachedPackages = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10분

/**
 * all-packages.json에서 패키지 데이터 로드
 */
async function loadAllPackages() {
  const now = Date.now();

  if (cachedPackages && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPackages;
  }

  try {
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const dataUrl = `${baseUrl}/data/all-packages.json`;

    console.log(`[GuideGenerator] 패키지 데이터 로드: ${dataUrl}`);

    const response = await fetch(dataUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data = await response.json();
    cachedPackages = data.packages || [];
    cacheTimestamp = now;

    console.log(`[GuideGenerator] ✅ ${cachedPackages.length}개 패키지 로드 완료`);
    return cachedPackages;
  } catch (error) {
    console.error(`[GuideGenerator] 패키지 로드 실패:`, error.message);
    return cachedPackages || [];
  }
}

/**
 * 패키지 이름으로 데이터 조회 (exampleCode 포함)
 */
async function findPackage(packageName) {
  const packages = await loadAllPackages();
  return packages.find((p) => p.name === packageName) || null;
}

/**
 * HTML 엔티티 디코딩
 */
function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&#47;/g, '/')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * 가이드 생성 메인 함수
 */
export async function generateGuide(packageName) {
  console.log(`[GuideGenerator] 시작: ${packageName}`);

  // 1. 패키지 데이터 조회
  const pkg = await findPackage(packageName);

  if (!pkg) {
    console.warn(`[GuideGenerator] 패키지를 찾을 수 없음: ${packageName}`);
    return null;
  }

  // 2. exampleCode 준비 (HTML 엔티티 디코딩 + 길이 제한)
  const rawExample = pkg.exampleCode || '';
  const exampleCode = decodeHtmlEntities(rawExample).substring(0, 1500);
  const hasExample = exampleCode.length > 50;

  console.log(`[GuideGenerator] 패키지 정보:`, {
    name: pkg.name,
    version: pkg.version,
    hasExample,
    exampleLength: exampleCode.length,
  });

  // 3. Gemini 프롬프트 구성
  const prompt = buildPrompt(pkg, exampleCode, hasExample);

  // 4. Gemini API 호출
  try {
    console.log(`[GuideGenerator] Gemini API 호출...`);
    const responseText = await callGeminiForGuide(prompt);

    if (!responseText) {
      throw new Error('Gemini 빈 응답');
    }

    // 5. JSON 파싱
    const guide = parseGuideResponse(responseText, pkg);
    return guide;
  } catch (error) {
    console.error(`[GuideGenerator] Gemini 에러:`, error.message);

    // Fallback: 기본 가이드 반환
    return createFallbackGuide(pkg, exampleCode);
  }
}

/**
 * Gemini 프롬프트 구성
 */
function buildPrompt(pkg, exampleCode, hasExample) {
  const exampleSection = hasExample
    ? `

## 공식 예제 코드 (참고용)
\`\`\`dart
${exampleCode}
\`\`\`
`
    : '';

  return `당신은 Flutter 전문가입니다. 아래 패키지의 구현 가이드를 JSON으로 작성하세요.

## 패키지 정보
- 이름: ${pkg.name}
- 버전: ${pkg.version || 'latest'}
- 설명: ${pkg.description || ''}
- 플랫폼: ${(pkg.platforms || []).join(', ') || 'all'}
${exampleSection}
## 출력 형식 (JSON만, 마크다운 없이)

{
  "packageId": "${pkg.name}",
  "title": "${pkg.name} 구현 가이드",
  "description": "이 패키지의 핵심 기능을 한 문장으로",
  "difficulty": "초급|중급|고급",
  "estimatedTime": "예상 소요 시간",
  "prerequisites": ["사전 준비사항 1-2개"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "패키지 설치",
      "description": "단계 설명",
      "code": {
        "language": "yaml",
        "filename": "pubspec.yaml",
        "content": "dependencies:\\n  ${pkg.name}: ^${pkg.version || 'latest'}"
      }
    },
    {
      "stepNumber": 2,
      "title": "기본 설정",
      "description": "단계 설명",
      "code": {
        "language": "dart",
        "filename": "main.dart",
        "content": "// 코드"
      }
    }
  ],
  "commonErrors": [
    { "error": "자주 발생하는 에러", "solution": "해결 방법" }
  ],
  "tips": ["유용한 팁 1-2개"],
  "references": [
    { "title": "공식 문서", "url": "https://pub.dev/packages/${pkg.name}" }
  ]
}

## 규칙
1. 한국어로 작성
2. steps는 3-4개로 핵심만 간결하게
3. 예제 코드가 있으면 참고하여 실제 사용법 반영
4. JSON만 출력, 다른 텍스트 없이`;
}

/**
 * Gemini 응답 파싱
 */
function parseGuideResponse(responseText, pkg) {
  // 마크다운 코드블록 제거
  let cleanJson = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 첫 번째 파싱 시도
  try {
    const guide = JSON.parse(cleanJson);
    console.log(`[GuideGenerator] ✅ JSON 파싱 성공`);
    return guide;
  } catch (e) {
    console.warn(`[GuideGenerator] 첫 번째 파싱 실패, 재시도...`);
  }

  // JSON 객체 추출 시도
  const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const guide = JSON.parse(jsonMatch[0]);
      console.log(`[GuideGenerator] ✅ JSON 추출 성공`);
      return guide;
    } catch (e) {
      console.warn(`[GuideGenerator] JSON 추출 실패`);
    }
  }

  // 파싱 실패 시 fallback
  console.warn(`[GuideGenerator] JSON 파싱 완전 실패, fallback 반환`);
  return createFallbackGuide(pkg, '');
}

/**
 * Fallback 가이드 생성
 */
function createFallbackGuide(pkg, exampleCode) {
  const steps = [
    {
      stepNumber: 1,
      title: '패키지 설치',
      description: `pubspec.yaml에 ${pkg.name} 패키지를 추가합니다.`,
      code: {
        language: 'yaml',
        filename: 'pubspec.yaml',
        content: `dependencies:\n  ${pkg.name}: ^${pkg.version || 'latest'}`,
      },
      command: 'flutter pub get',
    },
    {
      stepNumber: 2,
      title: '패키지 import',
      description: '사용할 파일에서 패키지를 import합니다.',
      code: {
        language: 'dart',
        filename: 'main.dart',
        content: `import 'package:${pkg.name}/${pkg.name}.dart';`,
      },
    },
  ];

  // exampleCode가 있으면 추가 단계로 포함
  if (exampleCode && exampleCode.length > 100) {
    steps.push({
      stepNumber: 3,
      title: '기본 사용 예제',
      description: '공식 예제를 참고하여 구현합니다.',
      code: {
        language: 'dart',
        filename: 'example.dart',
        content: exampleCode.substring(0, 800),
      },
    });
  }

  return {
    packageId: pkg.name,
    title: `${pkg.name} 구현 가이드`,
    description: pkg.description || `${pkg.name} 패키지 사용 가이드`,
    difficulty: '중급',
    estimatedTime: '30분',
    prerequisites: ['Flutter SDK 설치', 'Dart 기본 문법 이해'],
    steps,
    tips: ['공식 문서를 참고하여 추가 기능을 확인하세요.'],
    references: [
      { title: '공식 문서', url: `https://pub.dev/packages/${pkg.name}` },
    ],
    source: 'fallback',
  };
}

// 이전 함수명 호환성 유지
export { generateGuide as generateGuideFromPubDev };
