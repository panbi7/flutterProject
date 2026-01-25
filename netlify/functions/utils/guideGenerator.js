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
  const exampleCode = decodeHtmlEntities(rawExample).substring(0, 4000); // 1,500 -> 4,000으로 확대
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

  return `당신은 10년 차 이상의 시니어 Flutter 소프트웨어 엔지니어이자 탁월한 교육자입니다. 아래 패키지를 사용하여 앱을 개발하려는 후배 개발자에게 **"이것만 보면 바로 실무 코딩이 가능할 수준"**의 심층 구현 마스터 클래스 가이드를 작성하세요.

## 패키지 정보
- 이름: ${pkg.name}
- 버전: ${pkg.version || 'latest'}
- 설명: ${pkg.description || ''}
- 플랫폼: ${(pkg.platforms || []).join(', ') || 'all'}
${exampleSection}

## 출력 형식 (반드시 아래 순수 JSON만 출력)

{
  "packageId": "${pkg.name}",
  "title": "${pkg.name} 실무 마스터: 시니어 개발자의 구현 전략",
  "description": "패키지의 공식 설명을 넘어, 실제 현업에서 이 패키지가 해결해주는 핵심 문제와 가치를 정의",
  "difficulty": "초급|중급|고급",
  "estimatedTime": "실제 주니어 개발자가 완벽히 터득하는 데 걸리는 시간",
  "prerequisites": ["이 패키지를 다루기 전 반드시 알아야 하는 개념이나 도구 2-3개"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "기본 셋업 및 환경 구성",
      "description": "설치와 임포트부터 초기화까지 한 번에 끝내는 전문가의 방법",
      "substeps": ["가장 권장되는 설치 방식", "최적화된 라이브러리 초기화 위치"],
      "code": {
        "language": "dart",
        "filename": "pubspec.yaml / main.dart",
        "content": "// 한 줄 예제가 아닌, 전체적인 컨텍스트가 포함된 코드 블록"
      },
      "commands": ["flutter pub add ${pkg.name}"],
      "explanation": "왜 이 방식이 베스트 프랙티스인지에 대한 시니어의 설명"
    },
    {
      "stepNumber": 2,
      "title": "실무 핵심 아키텍처 구현",
      "description": "패키지의 메인 기능을 실제 앱의 UI나 비즈니스 로직과 결합하는 심층 과정",
      "substeps": [
        "핵심 클래스 활용법",
        "비동기 처리 및 데이터 스트림 관리",
        "StatefulWidget 또는 상태 관리 라이브러리와의 연동"
      ],
      "code": {
        "language": "dart",
        "filename": "custom_implementation.dart",
        "content": "// 바로 복사해서 사용 가능한 수준의 완성도 높은 코드"
      },
      "explanation": "코드의 동작 원리와 내부 매커니즘을 상세히 설명",
      "note": "이 단계에서 흔히 실수하는 포인트와 성능 최적화 꿀팁"
    }
  ],
  "commonErrors": [
    { "error": "심화 에러 상황", "solution": "원인 분석 및 해결 시나리오" }
  ],
  "tips": ["공식 문서에는 없는, 실전에서만 알 수 있는 트러블슈팅 및 최적화 기법 3개"],
  "nextSteps": [
    { "title": "고급 확장 기능", "description": "더 나아가서 적용해볼 수 있는 커스텀 구현이나 연동 아이디어" }
  ],
  "references": [
    { "title": "공식 문서", "url": "https://pub.dev/packages/${pkg.name}" }
  ]
}

## 시니어 가이드 규칙 (필독)
1. **설치 단계 최소화**: 뻔한 '설치', '추가'는 1단계로 요약하고, 2단계부터는 바로 **"어떻게 실제 화면에 그리거나 로직을 돌리는지"**에 집중하세요.
2. **코드 완성도**: snippets가 아닌, 하나의 완전한 **Class나 Function 단위**로 코드를 전달하여 가독성과 활용성을 높이세요.
3. **깊이 있는 설명**: "이 함수는 A를 합니다"가 아니라 "현업에서는 이 함수를 B 상황에서 C를 방지하기 위해 사용합니다"와 같이 **맥락(Context)**을 담아 설명하세요.
4. **학습 데이터 활용**: 위에서 제공된 '공식 예제 코드'의 패턴을 분석하여, 패키지마다의 특수한 사용법(예: 옵션 설정, 리스너 등록 등)을 가이드에 녹여내세요.
5. **언어**: 교육적이면서 친절한 한국어로 작성하세요.`;
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
