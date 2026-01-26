/**
 * 패키지 구현 가이드 생성기 v4.0
 *
 * 핵심 개선:
 * 1. 프롬프트 간소화 (토큰 절약)
 * 2. pub.dev API 직접 조회 지원
 * 3. 강화된 JSON 파싱
 * 4. 고품질 fallback 가이드
 */

import { callGeminiForGuide } from './gemini.js';
import { getPackageInfo } from './pubdevApi.js';

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
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'https://flutterwebkit.netlify.app';
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
 * 패키지 이름으로 데이터 조회 (로컬 → pub.dev 순서)
 */
async function findPackage(packageName) {
  // 1. 로컬 캐시에서 찾기
  const packages = await loadAllPackages();
  const localPkg = packages.find((p) => p.name === packageName);

  if (localPkg) {
    console.log(`[GuideGenerator] 로컬 캐시에서 찾음: ${packageName}`);
    return localPkg;
  }

  // 2. pub.dev API에서 직접 조회
  console.log(`[GuideGenerator] pub.dev API 조회: ${packageName}`);
  const pubdevInfo = await getPackageInfo(packageName);

  if (!pubdevInfo) {
    return null;
  }

  return {
    name: pubdevInfo.name,
    version: pubdevInfo.version,
    description: pubdevInfo.description,
    homepage: pubdevInfo.homepage,
    repository: pubdevInfo.repository,
    platforms: [],
    exampleCode: '',
  };
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

  // 디버그 정보 수집
  const debug = {
    packageName,
    timestamp: new Date().toISOString(),
    steps: [],
  };

  // 1. 패키지 데이터 조회
  const pkg = await findPackage(packageName);

  if (!pkg) {
    console.warn(`[GuideGenerator] 패키지를 찾을 수 없음: ${packageName}`);
    return null;
  }

  debug.steps.push({ step: 'package_found', name: pkg.name, version: pkg.version });

  // 2. exampleCode 준비
  const rawExample = pkg.exampleCode || '';
  const exampleCode = decodeHtmlEntities(rawExample).substring(0, 2000);
  const hasExample = exampleCode.length > 50;

  debug.steps.push({ step: 'example_code', hasExample, length: exampleCode.length });

  console.log(`[GuideGenerator] 패키지 정보:`, {
    name: pkg.name,
    version: pkg.version,
    hasExample,
    exampleLength: exampleCode.length,
  });

  // 3. Gemini 프롬프트 구성 (간소화된 버전)
  const prompt = buildPrompt(pkg, exampleCode, hasExample);
  debug.steps.push({ step: 'prompt_built', promptLength: prompt.length });

  // 4. Gemini API 호출
  try {
    console.log(`[GuideGenerator] Gemini API 호출 중...`);
    const responseText = await callGeminiForGuide(prompt);

    if (!responseText) {
      debug.steps.push({ step: 'gemini_error', reason: 'empty_response' });
      debug.fallbackReason = 'Gemini API가 빈 응답을 반환했습니다.';
      const fallback = createFallbackGuide(pkg, exampleCode);
      fallback._debug = debug;
      return fallback;
    }

    debug.steps.push({ step: 'gemini_response', responseLength: responseText.length });
    console.log(`[GuideGenerator] Gemini 응답 길이: ${responseText.length}자`);

    // 5. JSON 파싱
    const parseResult = parseGuideResponse(responseText, pkg);

    if (parseResult && parseResult.steps && parseResult.steps.length > 0) {
      console.log(`[GuideGenerator] ✅ 가이드 생성 성공: ${parseResult.steps.length}단계`);
      debug.steps.push({ step: 'parse_success', stepsCount: parseResult.steps.length });
      parseResult._debug = debug;
      return parseResult;
    }

    // 파싱 실패 원인 기록
    debug.steps.push({
      step: 'parse_failed',
      hasResult: !!parseResult,
      hasSteps: !!(parseResult && parseResult.steps),
      stepsLength: parseResult?.steps?.length || 0,
      responsePreview: responseText.substring(0, 500),
    });
    debug.fallbackReason = `JSON 파싱 실패 - 응답 미리보기: ${responseText.substring(0, 200)}...`;

    console.warn(`[GuideGenerator] 파싱된 가이드가 유효하지 않음, fallback 사용`);
    const fallback = createFallbackGuide(pkg, exampleCode);
    fallback._debug = debug;
    return fallback;
  } catch (error) {
    console.error(`[GuideGenerator] Gemini 에러:`, error.message);
    debug.steps.push({ step: 'gemini_exception', error: error.message });
    debug.fallbackReason = `Gemini API 에러: ${error.message}`;
    const fallback = createFallbackGuide(pkg, exampleCode);
    fallback._debug = debug;
    return fallback;
  }
}

/**
 * Gemini 프롬프트 - Flutter 전문가 스타일의 체계적 가이드 생성
 */
function buildPrompt(pkg, exampleCode, hasExample) {
  // 예제 코드 분석 지시문 생성
  const exampleAnalysisSection = hasExample
    ? `
═══════════════════════════════════════════════════════════════
📚 공식 예제 코드 (이 코드를 철저히 분석하여 가이드에 반영하세요)
═══════════════════════════════════════════════════════════════
\`\`\`dart
${exampleCode}
\`\`\`

【예제 코드 분석 가이드】
위 공식 예제를 분석하여 다음을 파악하세요:
1. 어떤 클래스/위젯이 사용되었는가? → coreConcepts에 반영
2. 초기화는 어떻게 하는가? (initState, 생성자 등) → Step 2에 상세히
3. 주요 메서드 호출 순서는? → Step 3에 단계별로
4. 콜백/이벤트 처리 방식은? → Step 4에 실전 패턴으로
5. 에러 처리는 어떻게 되어있는가? → commonErrors에 반영
6. 상태 관리 패턴은? → bestPractices에 반영
`
    : `
【예제 코드 없음】
pub.dev의 ${pkg.name} 패키지 공식 문서와 README를 기반으로
Flutter 전문가의 경험을 살려 체계적인 가이드를 작성하세요.
`;

  return `당신은 10년 경력의 시니어 Flutter 개발자이자 기술 교육 전문가입니다.
Flutter Korea 커뮤니티에서 활발히 활동하며, 수많은 개발자들을 가르쳐온 경험이 있습니다.
지금부터 "${pkg.name}" 패키지에 대한 **실전 구현 가이드**를 작성합니다.

═══════════════════════════════════════════════════════════════
📦 패키지 정보
═══════════════════════════════════════════════════════════════
• 패키지명: ${pkg.name}
• 버전: ${pkg.version || 'latest'}
• 설명: ${pkg.description || 'Flutter package'}
• pub.dev: https://pub.dev/packages/${pkg.name}
${exampleAnalysisSection}

═══════════════════════════════════════════════════════════════
🎯 가이드 작성 원칙 (매우 중요!)
═══════════════════════════════════════════════════════════════

【원칙 1: 실제 동작하는 코드만 작성】
- 복사해서 바로 실행할 수 있는 완전한 코드
- 모든 import문 포함
- 주석 없이도 이해되는 명확한 변수명
- 한국어 주석으로 "왜" 이렇게 하는지 설명

【원칙 2: 단계별 점진적 학습】
- Step 1: 설치 + 플랫폼별 필수 설정 (권한, Info.plist 등)
- Step 2: 가장 간단한 Hello World 수준 예제
- Step 3: 핵심 기능 하나씩 깊이있게 파고들기
- Step 4: 실제 앱에서 쓰는 패턴 (MVVM, Repository 등)
- Step 5: 고급 활용 + 성능 최적화

【원칙 3: 초보자 관점에서 설명】
- "당연히 알겠지"라고 생략하지 말 것
- 모든 개념에 일상적인 비유 추가
- 흔히 하는 실수와 해결법 명시
- 디버깅 방법까지 안내

【원칙 4: 실무 경험 기반 조언】
- 프로덕션에서 실제로 겪은 문제들
- 성능 이슈와 해결책
- 테스트 작성 방법
- CI/CD 고려사항

═══════════════════════════════════════════════════════════════
📝 JSON 출력 형식 (반드시 이 구조로!)
═══════════════════════════════════════════════════════════════

CRITICAL: 오직 유효한 JSON만 출력하세요. 마크다운, 설명, 코드블록 없이 순수 JSON만!

{
  "packageId": "${pkg.name}",
  "title": "${pkg.name} 실전 마스터 가이드",

  "overview": {
    "what": "[3-5문장] 이 패키지가 정확히 무엇인지. 어떤 문제를 해결하는지. 내부적으로 어떻게 동작하는지 간단히.",
    "why": "[3-5문장] 직접 구현 대비 이 패키지의 장점. 비슷한 패키지(예: xxx vs yyy) 대비 차별점. 언제 이 패키지를 선택해야 하는지.",
    "when": "[구체적 시나리오 3개 이상] 예: 1) 사용자 프로필 사진 선택 기능 구현 시, 2) 갤러리에서 다중 이미지 선택 시, 3) 카메라로 문서 스캔 시",
    "features": [
      "🎯 핵심기능1: 구체적으로 무엇을 할 수 있는지",
      "⚡ 핵심기능2: 성능/편의성 관점에서의 특징",
      "🔧 핵심기능3: 커스터마이징 가능한 부분",
      "📱 핵심기능4: 플랫폼별 지원 현황",
      "🛡️ 핵심기능5: 안정성/보안 관련 특징"
    ]
  },

  "description": "한 문장으로 패키지 핵심 가치 요약",
  "difficulty": "초급|중급|고급 (근거 포함)",
  "estimatedTime": "실제 학습에 필요한 현실적 시간",
  "prerequisites": [
    "Flutter 기본 위젯 (StatefulWidget, setState) 이해",
    "async/await 비동기 프로그래밍 기초",
    "필요한 사전 지식 3..."
  ],

  "coreConcepts": [
    {
      "term": "핵심 클래스/개념명",
      "explanation": "이것이 무엇이고, 전체 패키지에서 어떤 역할을 하는지. 언제 사용하는지.",
      "analogy": "☕ 커피머신에 비유하면... (일상적 비유로 쉽게 이해)",
      "usage": "실제 코드에서 이렇게 사용: ClassName.method()"
    },
    {
      "term": "두 번째 핵심 개념",
      "explanation": "상세 설명...",
      "analogy": "비유...",
      "usage": "사용법..."
    }
  ],

  "steps": [
    {
      "stepNumber": 1,
      "title": "🔧 프로젝트 설정 및 플랫폼별 구성",
      "description": "패키지 설치와 함께 Android/iOS 각각에서 필요한 설정을 완료합니다.",
      "code": {
        "language": "yaml",
        "filename": "pubspec.yaml",
        "content": "dependencies:\\n  flutter:\\n    sdk: flutter\\n  ${pkg.name}: ^${pkg.version || '1.0.0'}"
      },
      "commands": ["flutter pub add ${pkg.name}", "flutter pub get"],
      "explanation": "패키지 추가 후 각 플랫폼별 설정이 필요합니다.",
      "platformSetup": {
        "android": "【AndroidManifest.xml 수정사항】\\n필요한 권한, 쿼리, 설정 등을 구체적으로",
        "ios": "【Info.plist 수정사항】\\n필요한 권한 설명 문구, 설정 등을 구체적으로"
      },
      "beginnerTip": "💡 설정 후 반드시 앱을 완전히 재시작하세요. Hot reload로는 네이티브 설정이 반영되지 않습니다."
    },
    {
      "stepNumber": 2,
      "title": "📝 기본 사용법 - Hello World 예제",
      "description": "가장 단순한 형태로 패키지가 동작하는 것을 확인합니다. 복잡한 것 없이 핵심만!",
      "code": {
        "language": "dart",
        "filename": "lib/basic_example.dart",
        "content": "// 50줄 이상의 완전히 동작하는 코드\\n// import문부터 시작\\n// 모든 라인에 왜 필요한지 한국어 주석\\n// 실행하면 바로 결과 확인 가능"
      },
      "explanation": "【코드 흐름 설명】\\n1. 먼저 ~ 합니다\\n2. 그 다음 ~ 합니다\\n3. 결과적으로 ~ 됩니다",
      "beginnerTip": "⚠️ 초보자 주의: 흔히 하는 실수와 해결법"
    },
    {
      "stepNumber": 3,
      "title": "🎯 핵심 기능 심화 학습",
      "description": "패키지의 핵심 기능들을 하나씩 깊이있게 다룹니다.",
      "code": {
        "language": "dart",
        "filename": "lib/core_features.dart",
        "content": "// 각 핵심 기능별로 섹션 나눠서\\n// 기능 A 사용법\\n// 기능 B 사용법\\n// 기능 C 사용법"
      },
      "explanation": "【기능별 상세 설명】\\n• 기능 A: ~할 때 사용, 내부적으로 ~하게 동작\\n• 기능 B: ~할 때 사용, 주의할 점은...",
      "beginnerTip": "🔍 디버깅 팁: 문제 발생 시 이렇게 확인하세요"
    },
    {
      "stepNumber": 4,
      "title": "🏗️ 실전 프로젝트 패턴",
      "description": "실제 프로덕션 앱에서 사용하는 아키텍처 패턴을 적용합니다.",
      "code": {
        "language": "dart",
        "filename": "lib/production_pattern.dart",
        "content": "// Repository 패턴 또는 Service 클래스로 분리\\n// 에러 핸들링 완벽하게\\n// 로딩 상태 관리\\n// 실제 앱에서 바로 사용 가능한 수준"
      },
      "explanation": "【왜 이렇게 구조화하는가】\\n- 테스트 용이성\\n- 유지보수성\\n- 재사용성",
      "beginnerTip": "📁 폴더 구조 제안: lib/services/, lib/models/, lib/widgets/"
    },
    {
      "stepNumber": 5,
      "title": "⚡ 고급 활용 및 최적화",
      "description": "성능 최적화, 캐싱, 고급 설정 등을 다룹니다.",
      "code": {
        "language": "dart",
        "filename": "lib/advanced_usage.dart",
        "content": "// 성능 최적화 코드\\n// 캐싱 전략\\n// 메모리 관리\\n// 고급 설정 옵션"
      },
      "explanation": "【성능 고려사항】\\n- 메모리 사용량 최적화 방법\\n- 네트워크 요청 최소화\\n- dispose 패턴",
      "beginnerTip": "📊 프로파일링: DevTools로 성능 측정하는 방법"
    }
  ],

  "apiReference": [
    {
      "name": "ClassName / methodName",
      "description": "무엇을 하는 클래스/메서드인지",
      "parameters": "param1 (Type): 설명 | param2 (Type): 설명",
      "returns": "반환 타입과 의미",
      "example": "final result = ClassName.method(param1, param2);"
    }
  ],

  "commonErrors": [
    {
      "error": "실제 에러 메시지 전문",
      "cause": "【원인】 왜 이 에러가 발생하는지 상세히",
      "solution": "【해결법】 단계별로:\\n1. 먼저 ~확인\\n2. ~수정\\n3. ~재시작",
      "prevention": "【예방법】 이런 습관을 들이면 방지할 수 있습니다"
    },
    {
      "error": "MissingPluginException",
      "cause": "네이티브 플러그인이 제대로 등록되지 않았습니다. Hot reload로는 네이티브 코드가 반영되지 않기 때문입니다.",
      "solution": "1. flutter clean 실행\\n2. flutter pub get 실행\\n3. 앱 완전히 종료 후 재시작 (flutter run)",
      "prevention": "네이티브 기능 패키지 추가 후에는 항상 앱을 재시작하세요."
    }
  ],

  "bestPractices": [
    {
      "title": "✅ 권장 패턴 제목",
      "description": "왜 이 패턴을 사용해야 하는지, 어떤 이점이 있는지",
      "doThis": "// 좋은 예시 코드\\nfinal result = await service.getData();\\nif (result != null) { ... }",
      "dontDoThis": "// 나쁜 예시 코드\\nservice.getData().then((r) => ...)  // 콜백 지옥"
    }
  ],

  "tips": [
    "💡 [생산성] 실무에서 시간 절약하는 팁",
    "🐛 [디버깅] 문제 발생 시 빠르게 원인 찾는 방법",
    "⚡ [성능] 앱 성능을 높이는 최적화 팁",
    "🧪 [테스트] 이 패키지를 테스트하는 방법",
    "📱 [플랫폼] iOS/Android 각각에서 주의할 점"
  ],

  "relatedPackages": [
    {
      "name": "관련 패키지명",
      "description": "이 패키지와 함께 사용하면 시너지가 나는 이유"
    }
  ],

  "references": [
    {"title": "📦 pub.dev 공식 페이지", "url": "https://pub.dev/packages/${pkg.name}"},
    {"title": "📖 API 문서", "url": "https://pub.dev/documentation/${pkg.name}/latest/"},
    {"title": "💻 GitHub 저장소", "url": "${pkg.repository || pkg.homepage || '#'}"}
  ]
}

═══════════════════════════════════════════════════════════════
🚨 최종 점검 사항
═══════════════════════════════════════════════════════════════
출력 전 반드시 확인하세요:
□ 모든 코드가 실제로 동작하는가? (import 누락, 오타 없는지)
□ 한국어로 작성되었는가?
□ 초보자가 이해할 수 있는 설명인가?
□ 각 단계가 논리적으로 연결되는가?
□ 플랫폼별 설정이 구체적인가?
□ 유효한 JSON 형식인가? (마크다운 코드블록 없이)

지금 "${pkg.name}" 패키지에 대한 완벽한 구현 가이드를 JSON으로 출력하세요:`;
}

/**
 * 강화된 JSON 파싱
 */
function parseGuideResponse(responseText, pkg) {
  // 1. 마크다운 코드블록 제거
  let cleanJson = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 2. 첫 번째 파싱 시도
  try {
    const guide = JSON.parse(cleanJson);
    if (isValidGuide(guide)) {
      console.log(`[GuideGenerator] ✅ JSON 직접 파싱 성공`);
      return guide;
    }
  } catch (e) {
    console.warn(`[GuideGenerator] 첫 번째 파싱 실패: ${e.message}`);
  }

  // 3. JSON 객체 추출 시도 (중괄호 매칭)
  const jsonStart = cleanJson.indexOf('{');
  const jsonEnd = cleanJson.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const extracted = cleanJson.substring(jsonStart, jsonEnd + 1);
    try {
      const guide = JSON.parse(extracted);
      if (isValidGuide(guide)) {
        console.log(`[GuideGenerator] ✅ JSON 추출 파싱 성공`);
        return guide;
      }
    } catch (e) {
      console.warn(`[GuideGenerator] 추출 파싱 실패: ${e.message}`);
    }
  }

  // 4. 특수 문자 정리 후 재시도
  try {
    const sanitized = cleanJson
      .replace(/[\x00-\x1F\x7F]/g, ' ') // 제어 문자 제거
      .replace(/,\s*}/g, '}') // trailing comma 제거
      .replace(/,\s*]/g, ']');

    const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const guide = JSON.parse(jsonMatch[0]);
      if (isValidGuide(guide)) {
        console.log(`[GuideGenerator] ✅ 정리 후 파싱 성공`);
        return guide;
      }
    }
  } catch (e) {
    console.warn(`[GuideGenerator] 정리 후 파싱도 실패: ${e.message}`);
  }

  console.error(`[GuideGenerator] ❌ JSON 파싱 완전 실패`);
  console.log(`[GuideGenerator] 응답 앞부분: ${responseText.substring(0, 500)}`);
  return null;
}

/**
 * 가이드 유효성 검사
 */
function isValidGuide(guide) {
  // 기본 구조 확인
  if (!guide || typeof guide !== 'object') return false;
  if (!guide.steps || !Array.isArray(guide.steps) || guide.steps.length === 0) return false;
  if (!guide.steps[0].code) return false;

  // overview가 있으면 더 좋은 가이드
  const hasOverview = guide.overview && guide.overview.what;

  console.log(`[GuideGenerator] 가이드 유효성: steps=${guide.steps.length}, hasOverview=${hasOverview}`);

  return true;
}

/**
 * 고품질 Fallback 가이드 생성 - 상세 설명 포함
 */
function createFallbackGuide(pkg, exampleCode) {
  const pascalName = toPascalCase(pkg.name);
  const desc = pkg.description || `${pkg.name} 패키지`;

  const steps = [
    {
      stepNumber: 1,
      title: '패키지 설치 및 설정',
      description: `${pkg.name} 패키지를 Flutter 프로젝트에 추가하고 필요한 설정을 완료합니다.`,
      code: {
        language: 'yaml',
        filename: 'pubspec.yaml',
        content: `dependencies:
  flutter:
    sdk: flutter
  ${pkg.name}: ^${pkg.version || 'latest'}  # 최신 버전 사용 권장

# 터미널에서 실행:
# flutter pub add ${pkg.name}`,
      },
      commands: [`flutter pub add ${pkg.name}`],
      explanation: 'pubspec.yaml에 의존성을 추가하고 flutter pub get으로 패키지를 다운로드합니다.',
      platformSetup: {
        android: 'AndroidManifest.xml에 필요한 권한이 있는지 공식 문서를 확인하세요.',
        ios: 'Info.plist에 필요한 설정이 있는지 공식 문서를 확인하세요.',
      },
      beginnerTip: 'flutter pub add 명령어를 사용하면 자동으로 최신 호환 버전이 추가됩니다.',
    },
    {
      stepNumber: 2,
      title: '기본 사용법 익히기',
      description: `${pkg.name} 패키지의 기본적인 사용 방법을 학습합니다.`,
      code: {
        language: 'dart',
        filename: 'lib/main.dart',
        content: `import 'package:flutter/material.dart';
import 'package:${pkg.name}/${pkg.name}.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${pkg.name} Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const ${pascalName}Example(),
    );
  }
}

class ${pascalName}Example extends StatefulWidget {
  const ${pascalName}Example({super.key});

  @override
  State<${pascalName}Example> createState() => _${pascalName}ExampleState();
}

class _${pascalName}ExampleState extends State<${pascalName}Example> {
  // 상태 변수 선언
  bool _isLoading = false;
  String _result = '';

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    // ${pkg.name} 초기화 로직
    // 공식 문서를 참고하여 구현하세요
  }

  Future<void> _executeFeature() async {
    setState(() => _isLoading = true);
    try {
      // ${pkg.name} 기능 실행
      // 공식 문서의 예제를 참고하세요
      setState(() => _result = '성공!');
    } catch (e) {
      setState(() => _result = '에러: \$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${pkg.name} Example'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${pkg.name}',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              Text(
                '${desc}',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600]),
              ),
              const SizedBox(height: 30),
              if (_isLoading)
                const CircularProgressIndicator()
              else
                ElevatedButton.icon(
                  onPressed: _executeFeature,
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('기능 실행'),
                ),
              const SizedBox(height: 20),
              if (_result.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_result),
                ),
            ],
          ),
        ),
      ),
    );
  }
}`,
      },
      explanation: '기본 앱 구조와 함께 패키지를 import하고 사용할 준비를 합니다. _executeFeature() 메서드에 실제 패키지 기능을 구현하세요.',
      beginnerTip: 'async/await 패턴으로 비동기 작업을 처리하고, try-catch로 에러를 핸들링하는 것이 좋습니다.',
    },
  ];

  // 예제 코드가 있으면 3번째 단계로 추가
  if (exampleCode && exampleCode.length > 100) {
    steps.push({
      stepNumber: 3,
      title: '공식 예제 코드 분석',
      description: 'pub.dev에서 제공하는 공식 예제 코드입니다. 이 코드를 분석하고 프로젝트에 적용하세요.',
      code: {
        language: 'dart',
        filename: 'lib/official_example.dart',
        content: exampleCode,
      },
      explanation: '공식 예제 코드를 분석하여 패키지의 핵심 사용법을 파악하세요. 주요 클래스와 메서드가 어떻게 사용되는지 확인하세요.',
    });
  }

  return {
    packageId: pkg.name,
    title: `${pkg.name} 완벽 가이드`,

    // 상세 설명 섹션
    overview: {
      what: `${pkg.name}은(는) ${desc} 이 패키지를 사용하면 복잡한 기능을 쉽게 구현할 수 있으며, Flutter 앱 개발에서 자주 필요한 기능을 제공합니다. 공식 문서와 예제를 통해 더 자세한 정보를 확인하세요.`,
      why: `직접 구현하면 많은 시간과 노력이 필요한 기능을 ${pkg.name} 패키지로 쉽게 해결할 수 있습니다. 커뮤니티에서 검증된 패키지이며, 지속적으로 유지보수되고 있어 안정적입니다. 다양한 엣지 케이스가 이미 처리되어 있어 프로덕션 환경에서도 안심하고 사용할 수 있습니다.`,
      when: `앱에서 ${desc.toLowerCase()}이(가) 필요할 때 사용합니다. 프로토타입 개발 시 빠르게 기능을 구현하고 싶을 때, 검증된 솔루션이 필요할 때 적합합니다.`,
      features: [
        '공식 문서에서 전체 기능 목록을 확인하세요',
        'pub.dev에서 예제 코드를 참고하세요',
        'GitHub 저장소에서 상세 사용법을 확인하세요',
      ],
    },

    description: desc,
    difficulty: '중급',
    estimatedTime: '30분 - 1시간',
    prerequisites: [
      'Flutter SDK 설치 및 기본 프로젝트 생성 경험',
      'Dart 비동기 프로그래밍 (async/await) 이해',
      'StatefulWidget 라이프사이클 이해',
    ],
    coreConcepts: [
      {
        term: pkg.name,
        explanation: desc,
        analogy: '자세한 내용은 pub.dev 공식 문서를 참고하세요.',
        usage: '앱에서 해당 기능이 필요할 때 import하여 사용합니다.',
      },
    ],
    steps,
    apiReference: [
      {
        name: '주요 API',
        description: 'pub.dev 문서에서 전체 API 레퍼런스를 확인하세요.',
        parameters: '공식 문서 참고',
        returns: '공식 문서 참고',
        example: '공식 예제 코드 참고',
      },
    ],
    commonErrors: [
      {
        error: 'MissingPluginException',
        cause: '네이티브 플러그인이 제대로 로드되지 않았습니다.',
        solution: 'flutter clean && flutter pub get 실행 후 앱을 완전히 재시작하세요.',
        prevention: '핫 리로드 대신 앱을 완전히 재시작하면 대부분 해결됩니다.',
      },
      {
        error: 'Version solving failed',
        cause: '다른 패키지와 버전 충돌이 발생했습니다.',
        solution: 'flutter pub deps로 의존성 트리를 확인하고, 호환되는 버전을 찾으세요.',
        prevention: '패키지 추가 전 호환성을 미리 확인하세요.',
      },
      {
        error: `Cannot find package '${pkg.name}'`,
        cause: '패키지 이름이 잘못되었거나 pubspec.yaml에 추가되지 않았습니다.',
        solution: `flutter pub add ${pkg.name}으로 패키지를 추가하세요.`,
        prevention: 'pub.dev에서 정확한 패키지 이름을 확인하세요.',
      },
    ],
    bestPractices: [
      {
        title: '버전 고정',
        description: '프로덕션 앱에서는 특정 버전을 고정하여 예기치 않은 업데이트로 인한 문제를 방지하세요.',
        doThis: `${pkg.name}: ^${pkg.version || '1.0.0'} 형태로 메이저 버전 고정`,
        dontDoThis: `${pkg.name}: any 같은 느슨한 버전 지정`,
      },
      {
        title: '에러 핸들링',
        description: '패키지 기능 호출 시 try-catch로 예외를 처리하고, 사용자에게 친절한 에러 메시지를 보여주세요.',
        doThis: 'try-catch로 감싸고 사용자 친화적 메시지 표시',
        dontDoThis: '에러 처리 없이 직접 호출',
      },
    ],
    tips: [
      `${pkg.name}의 공식 README를 꼭 읽어보세요. 최신 사용법이 정리되어 있습니다.`,
      'GitHub Issues에서 다른 개발자들의 질문과 해결책을 참고하면 도움이 됩니다.',
      '패키지 버전 업데이트 시 CHANGELOG를 확인하여 breaking changes를 파악하세요.',
      '예제 프로젝트가 있다면 clone하여 직접 실행해보는 것이 가장 빠른 학습 방법입니다.',
    ],
    relatedPackages: [
      {
        name: '관련 패키지',
        description: 'pub.dev에서 비슷한 기능의 패키지를 검색해보세요.',
      },
    ],
    references: [
      { title: 'pub.dev 공식 문서', url: `https://pub.dev/packages/${pkg.name}` },
      { title: 'API Reference', url: `https://pub.dev/documentation/${pkg.name}/latest/` },
    ],
    source: 'fallback',
  };
}

/**
 * 문자열을 PascalCase로 변환
 */
function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export { generateGuide as generateGuideFromPubDev };
