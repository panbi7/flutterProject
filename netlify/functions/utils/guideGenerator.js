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

  // 1. 패키지 데이터 조회
  const pkg = await findPackage(packageName);

  if (!pkg) {
    console.warn(`[GuideGenerator] 패키지를 찾을 수 없음: ${packageName}`);
    return null;
  }

  // 2. exampleCode 준비
  const rawExample = pkg.exampleCode || '';
  const exampleCode = decodeHtmlEntities(rawExample).substring(0, 2000);
  const hasExample = exampleCode.length > 50;

  console.log(`[GuideGenerator] 패키지 정보:`, {
    name: pkg.name,
    version: pkg.version,
    hasExample,
    exampleLength: exampleCode.length,
  });

  // 3. Gemini 프롬프트 구성 (간소화된 버전)
  const prompt = buildPrompt(pkg, exampleCode, hasExample);

  // 4. Gemini API 호출
  try {
    console.log(`[GuideGenerator] Gemini API 호출 중...`);
    const responseText = await callGeminiForGuide(prompt);

    if (!responseText) {
      throw new Error('Gemini 빈 응답');
    }

    console.log(`[GuideGenerator] Gemini 응답 길이: ${responseText.length}자`);

    // 5. JSON 파싱
    const guide = parseGuideResponse(responseText, pkg);

    if (guide && guide.steps && guide.steps.length > 0) {
      console.log(`[GuideGenerator] ✅ 가이드 생성 성공: ${guide.steps.length}단계`);
      return guide;
    }

    console.warn(`[GuideGenerator] 파싱된 가이드가 유효하지 않음, fallback 사용`);
    return createFallbackGuide(pkg, exampleCode);
  } catch (error) {
    console.error(`[GuideGenerator] Gemini 에러:`, error.message);
    return createFallbackGuide(pkg, exampleCode);
  }
}

/**
 * 간소화된 Gemini 프롬프트
 */
function buildPrompt(pkg, exampleCode, hasExample) {
  const exampleSection = hasExample
    ? `\n\n## 공식 예제 코드\n\`\`\`dart\n${exampleCode}\n\`\`\``
    : '';

  return `당신은 Flutter/Dart 전문가입니다. "${pkg.name}" 패키지의 구현 가이드를 JSON으로 작성하세요.

## 패키지 정보
- 이름: ${pkg.name}
- 버전: ${pkg.version || 'latest'}
- 설명: ${pkg.description || ''}
${exampleSection}

## 작성 규칙
1. 반드시 순수 JSON만 출력 (마크다운 코드블록 없이)
2. 모든 코드는 한국어 주석 포함
3. 실제로 동작하는 완전한 코드 작성
4. 초보자도 이해할 수 있게 설명

## 필수 JSON 구조
{
  "packageId": "${pkg.name}",
  "title": "${pkg.name} 완벽 가이드",
  "description": "패키지 설명 (2-3문장)",
  "difficulty": "초급/중급/고급",
  "estimatedTime": "예상 학습 시간",
  "prerequisites": ["사전 지식 1", "사전 지식 2"],
  "coreConcepts": [
    {
      "term": "핵심 개념 이름",
      "explanation": "쉬운 설명",
      "analogy": "일상적인 비유"
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "title": "설치 및 설정",
      "description": "단계 설명",
      "code": {
        "language": "dart",
        "filename": "lib/main.dart",
        "content": "// 완전한 동작 코드 (최소 30줄 이상)\\nimport 'package:flutter/material.dart';\\n..."
      },
      "commands": ["flutter pub add ${pkg.name}"],
      "explanation": "이 코드가 하는 일 설명",
      "beginnerTip": "초보자 팁"
    },
    {
      "stepNumber": 2,
      "title": "기본 사용법",
      "description": "단계 설명",
      "code": {
        "language": "dart",
        "filename": "lib/example.dart",
        "content": "// 기본 사용 예제 코드..."
      },
      "explanation": "설명"
    },
    {
      "stepNumber": 3,
      "title": "고급 활용",
      "description": "단계 설명",
      "code": {
        "language": "dart",
        "filename": "lib/advanced.dart",
        "content": "// 고급 사용 예제..."
      },
      "explanation": "설명"
    }
  ],
  "commonErrors": [
    {
      "error": "에러 메시지",
      "cause": "원인",
      "solution": "해결책"
    }
  ],
  "tips": ["팁 1", "팁 2", "팁 3"],
  "bestPractices": [
    {
      "title": "제목",
      "description": "설명"
    }
  ],
  "references": [
    {"title": "pub.dev", "url": "https://pub.dev/packages/${pkg.name}"}
  ]
}

위 구조에 맞춰 "${pkg.name}" 패키지의 상세 구현 가이드를 JSON으로 출력하세요:`;
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
  return (
    guide &&
    typeof guide === 'object' &&
    guide.steps &&
    Array.isArray(guide.steps) &&
    guide.steps.length > 0 &&
    guide.steps[0].code
  );
}

/**
 * 고품질 Fallback 가이드 생성
 */
function createFallbackGuide(pkg, exampleCode) {
  const pascalName = toPascalCase(pkg.name);

  const steps = [
    {
      stepNumber: 1,
      title: '패키지 설치',
      description: `${pkg.name} 패키지를 Flutter 프로젝트에 추가합니다.`,
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
      beginnerTip: 'flutter pub add 명령어를 사용하면 자동으로 최신 버전이 추가됩니다.',
    },
    {
      stepNumber: 2,
      title: '기본 사용법',
      description: `${pkg.name} 패키지의 기본적인 사용 방법입니다.`,
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
  // TODO: ${pkg.name} 관련 상태 변수 선언

  @override
  void initState() {
    super.initState();
    // TODO: 초기화 로직
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${pkg.name} Example'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              '${pkg.name} 패키지 사용 예제',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                // TODO: ${pkg.name} 기능 호출
              },
              child: const Text('기능 실행'),
            ),
          ],
        ),
      ),
    );
  }
}`,
      },
      explanation: '기본 앱 구조와 함께 패키지를 import하고 사용할 준비를 합니다. TODO 주석 부분을 실제 구현으로 채워넣으세요.',
    },
  ];

  // 예제 코드가 있으면 3번째 단계로 추가
  if (exampleCode && exampleCode.length > 100) {
    steps.push({
      stepNumber: 3,
      title: '공식 예제 코드',
      description: 'pub.dev에서 제공하는 공식 예제 코드입니다. 이 코드를 참고하여 구현하세요.',
      code: {
        language: 'dart',
        filename: 'lib/official_example.dart',
        content: exampleCode,
      },
      explanation: '공식 예제 코드를 분석하여 패키지의 핵심 사용법을 파악하세요.',
    });
  }

  return {
    packageId: pkg.name,
    title: `${pkg.name} 구현 가이드`,
    description: pkg.description || `${pkg.name} 패키지를 Flutter 프로젝트에서 사용하는 방법을 안내합니다.`,
    difficulty: '중급',
    estimatedTime: '30분 - 1시간',
    prerequisites: [
      'Flutter SDK 설치 및 기본 프로젝트 생성',
      'Dart 문법 기초 이해',
      'StatefulWidget 라이프사이클 이해',
    ],
    coreConcepts: [
      {
        term: pkg.name,
        explanation: pkg.description || '이 패키지에 대한 설명입니다.',
        analogy: '자세한 내용은 pub.dev 공식 문서를 참고하세요.',
      },
    ],
    steps,
    commonErrors: [
      {
        error: 'MissingPluginException',
        cause: '네이티브 플러그인이 제대로 로드되지 않았습니다.',
        solution: 'flutter clean && flutter pub get 실행 후 앱을 완전히 재시작하세요. iOS의 경우 cd ios && pod install도 필요할 수 있습니다.',
      },
      {
        error: 'Version solving failed',
        cause: '다른 패키지와 버전 충돌이 발생했습니다.',
        solution: 'flutter pub deps로 의존성 트리를 확인하고, 호환되는 버전을 찾으세요.',
      },
      {
        error: `Cannot find package '${pkg.name}'`,
        cause: '패키지 이름이 잘못되었거나 pubspec.yaml에 추가되지 않았습니다.',
        solution: `flutter pub add ${pkg.name}으로 패키지를 추가하세요.`,
      },
    ],
    tips: [
      `${pkg.name}의 공식 README를 꼭 읽어보세요. 최신 사용법이 정리되어 있습니다.`,
      'GitHub Issues에서 다른 개발자들의 질문과 해결책을 참고하면 도움이 됩니다.',
      '패키지 버전 업데이트 시 CHANGELOG를 확인하여 breaking changes를 파악하세요.',
      '예제 프로젝트가 있다면 clone하여 직접 실행해보는 것이 가장 빠른 학습 방법입니다.',
    ],
    bestPractices: [
      {
        title: '버전 고정',
        description: '프로덕션 앱에서는 특정 버전을 고정하여 예기치 않은 업데이트로 인한 문제를 방지하세요.',
      },
      {
        title: '에러 핸들링',
        description: '패키지 기능 호출 시 try-catch로 예외를 처리하고, 사용자에게 친절한 에러 메시지를 보여주세요.',
      },
    ],
    nextSteps: [
      {
        title: '고급 기능 탐색',
        description: '공식 문서의 Advanced 섹션을 참고하여 추가 기능을 활용해보세요.',
      },
      {
        title: '테스트 작성',
        description: '패키지 기능에 대한 단위 테스트를 작성하여 안정성을 확보하세요.',
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
