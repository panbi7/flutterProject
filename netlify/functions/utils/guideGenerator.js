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

  return `당신은 세계 최고의 Flutter 및 Dart 전문가입니다. 아래 패키지를 사용하여 앱을 구현하려는 개발자를 위해 **완벽하고 상세한 구현 가이드**를 JSON 형식으로 작성하세요.

## 패키지 정보
- 이름: ${pkg.name}
- 버전: ${pkg.version || 'latest'}
- 설명: ${pkg.description || ''}
- 플랫폼: ${(pkg.platforms || []).join(', ') || 'all'}
${exampleSection}

## 출력 형식 (반드시 아래 구조의 순수 JSON만 출력하세요)

{
  "packageId": "${pkg.name}",
  "title": "${pkg.name} 마스터 가이드: 설치부터 실무 구현까지",
  "description": "이 패키지의 핵심 목적과 기능을 개발자 관점에서 한 문장으로 정의",
  "difficulty": "초급|중급|고급",
  "estimatedTime": "실제 구현에 걸리는 예상 시간 (예: 20분)",
  "prerequisites": ["사전 필요한 설정이나 지식 2-3개"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "단계 제목",
      "description": "이 단계에서 수행할 작업의 핵심 설명",
      "substeps": ["구체적인 세부 실행 항목 1", "구체적인 세부 실행 항목 2"],
      "code": {
        "language": "dart|yaml|bash",
        "filename": "파일명",
        "content": "// 실제 작동하는 고품질 코드 예제"
      },
      "commands": ["실행할 터미널 명령어들"],
      "explanation": "코드에 대한 친절하고 상세한 설명",
      "note": "주의사항이나 꿀팁"
    }
  ],
  "commonErrors": [
    { "error": "에러 상황", "solution": "해결 방법", "link": "참고 URL(선택)" }
  ],
  "tips": ["전문가만의 최적화 팁이나 실무 노하우 2-3개"],
  "nextSteps": [
    { "title": "다음 도전 과제", "description": "가이드 완료 후 시도해볼 만한 응용 기능" }
  ],
  "references": [
    { "title": "공식 문서", "url": "https://pub.dev/packages/${pkg.name}" }
  ]
}

## 규칙
1. **분량 극대화**: steps는 최소 5개에서 최대 8개까지 매우 상세하게 작성하세요.
2. **구조 활용**: substeps, explanation, note, commands, nextSteps 필드를 적극적으로 사용하여 정보를 풍성하게 만드세요.
3. **실무 중심**: 단순히 패키지 로드만 보여주지 말고, 실제 앱에서 에러 핸들링이나 상태 관리와 연동하는 실무적인 패턴을 포함하세요.
4. **언어**: 모든 텍스트 설명은 친절한 한국어로 작성하세요.
5. **순수 JSON**: 마크다운 코드 블록(\`\`\`json) 없이 오직 JSON 객체만 출력하세요.`;
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
