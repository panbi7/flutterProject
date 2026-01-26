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
 * Gemini 프롬프트 - 패키지 상세 설명 포함
 */
function buildPrompt(pkg, exampleCode, hasExample) {
  const exampleSection = hasExample
    ? `\n\n[공식 예제 코드]\n${exampleCode}`
    : '';

  return `You are a senior Flutter developer and technical writer. Create a comprehensive JSON guide for the "${pkg.name}" package in Korean.

Package: ${pkg.name}
Version: ${pkg.version || 'latest'}
Description: ${pkg.description || 'Flutter package'}
${exampleSection}

CRITICAL: Output ONLY valid JSON. No markdown, no explanation.

Required JSON structure with DETAILED explanations:
{
  "packageId": "${pkg.name}",
  "title": "${pkg.name} 완벽 마스터 가이드",

  "overview": {
    "what": "이 패키지가 무엇인지 상세히 설명 (3-5문장). 어떤 문제를 해결하는지, 핵심 기능이 무엇인지",
    "why": "왜 이 패키지를 사용해야 하는지 (3-5문장). 직접 구현 대비 장점, 다른 패키지와의 차별점",
    "when": "언제 사용하면 좋은지 구체적인 사용 시나리오 3가지 이상",
    "features": [
      "주요 기능 1: 상세 설명",
      "주요 기능 2: 상세 설명",
      "주요 기능 3: 상세 설명",
      "주요 기능 4: 상세 설명",
      "주요 기능 5: 상세 설명"
    ]
  },

  "description": "패키지 한줄 요약",
  "difficulty": "초급/중급/고급",
  "estimatedTime": "예상 학습 시간",
  "prerequisites": ["사전 지식 1", "사전 지식 2", "사전 지식 3"],

  "coreConcepts": [
    {
      "term": "핵심 개념/클래스명",
      "explanation": "이 개념이 무엇이고 왜 중요한지 상세 설명",
      "analogy": "초보자도 이해할 수 있는 일상적인 비유",
      "usage": "실제로 어떤 상황에서 사용하는지"
    }
  ],

  "steps": [
    {
      "stepNumber": 1,
      "title": "패키지 설치 및 설정",
      "description": "단계에서 할 일 상세 설명",
      "code": {
        "language": "dart",
        "filename": "pubspec.yaml",
        "content": "dependencies:\\n  flutter:\\n    sdk: flutter\\n  ${pkg.name}: ^${pkg.version || '1.0.0'}"
      },
      "commands": ["flutter pub add ${pkg.name}"],
      "explanation": "이 코드가 하는 일과 각 부분의 의미",
      "platformSetup": {
        "android": "안드로이드 추가 설정 (필요시)",
        "ios": "iOS 추가 설정 (필요시)"
      }
    },
    {
      "stepNumber": 2,
      "title": "기본 사용법 익히기",
      "description": "가장 기본적인 사용 방법",
      "code": {
        "language": "dart",
        "filename": "lib/main.dart",
        "content": "// 40줄 이상의 완전한 동작 코드\\n// 한국어 주석으로 각 줄 설명"
      },
      "explanation": "코드의 동작 원리와 각 함수/클래스의 역할",
      "beginnerTip": "초보자가 흔히 실수하는 부분과 해결법"
    },
    {
      "stepNumber": 3,
      "title": "핵심 기능 활용",
      "description": "패키지의 핵심 기능 사용법",
      "code": {
        "language": "dart",
        "filename": "lib/features.dart",
        "content": "// 핵심 기능별 예제 코드"
      },
      "explanation": "각 기능의 동작 원리"
    },
    {
      "stepNumber": 4,
      "title": "실전 프로젝트 적용",
      "description": "실제 앱에서 활용하는 방법",
      "code": {
        "language": "dart",
        "filename": "lib/real_world_example.dart",
        "content": "// 실제 프로젝트에서 사용하는 패턴"
      },
      "explanation": "실무에서 자주 사용하는 패턴과 이유"
    }
  ],

  "apiReference": [
    {
      "name": "주요 클래스/함수명",
      "description": "무엇을 하는지",
      "parameters": "주요 파라미터 설명",
      "returns": "반환값 설명",
      "example": "간단한 사용 예시"
    }
  ],

  "commonErrors": [
    {
      "error": "에러 메시지",
      "cause": "발생 원인 상세 설명",
      "solution": "해결 방법 단계별 설명",
      "prevention": "예방하는 방법"
    }
  ],

  "bestPractices": [
    {
      "title": "베스트 프랙티스 제목",
      "description": "왜 이렇게 해야 하는지, 어떻게 적용하는지",
      "doThis": "권장하는 방법",
      "dontDoThis": "피해야 할 방법"
    }
  ],

  "tips": [
    "실무에서 유용한 팁 1",
    "실무에서 유용한 팁 2",
    "성능 최적화 팁",
    "디버깅 팁"
  ],

  "relatedPackages": [
    {
      "name": "관련 패키지명",
      "description": "함께 사용하면 좋은 이유"
    }
  ],

  "references": [
    {"title": "pub.dev 공식 문서", "url": "https://pub.dev/packages/${pkg.name}"},
    {"title": "API 문서", "url": "https://pub.dev/documentation/${pkg.name}/latest/"}
  ]
}

Generate a comprehensive, beginner-friendly guide for "${pkg.name}" with all fields filled in Korean:`;
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
