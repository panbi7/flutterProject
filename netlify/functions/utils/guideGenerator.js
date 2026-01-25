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
 * Gemini 프롬프트 구성 - Few-shot 예시 포함
 */
function buildPrompt(pkg, exampleCode, hasExample) {
  const exampleSection = hasExample
    ? `

## 공식 예제 코드 (이 코드를 분석하여 가이드에 반영하세요)
\`\`\`dart
${exampleCode}
\`\`\`
`
    : '';

  // Few-shot 예시: 실제 고품질 가이드의 모범 사례
  const fewShotExample = `
## 🎯 모범 가이드 예시 (이 수준으로 작성하세요)

다음은 "dio" 패키지에 대한 모범 가이드입니다. 이 품질과 깊이를 참고하여 작성하세요:

\`\`\`json
{
  "packageId": "dio",
  "title": "Dio 완벽 마스터: 프로덕션 레벨 HTTP 클라이언트 구축",
  "description": "Flutter 앱에서 REST API 통신의 모든 것을 다루는 Dio 패키지. 단순 HTTP 요청을 넘어 인터셉터 기반 인증 처리, 요청/응답 로깅, 에러 핸들링, 파일 업로드/다운로드까지 실무에서 필요한 모든 네트워크 레이어를 구축합니다.",
  "difficulty": "중급",
  "estimatedTime": "2-3시간",
  "prerequisites": ["Dart async/await 패턴 이해", "REST API 기본 개념 (GET/POST/PUT/DELETE)", "JSON 직렬화/역직렬화"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "프로젝트 설정 및 Dio 인스턴스 싱글톤 구성",
      "description": "Dio를 매번 생성하지 않고 앱 전체에서 재사용 가능한 싱글톤 패턴으로 구성합니다. BaseOptions로 기본 URL, 타임아웃, 헤더를 중앙 관리합니다.",
      "substeps": [
        "pubspec.yaml에 dio 패키지 추가",
        "API 클라이언트 싱글톤 클래스 생성",
        "환경별(dev/staging/prod) baseUrl 분기 처리"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/core/network/api_client.dart",
        "content": "import 'package:dio/dio.dart';\\n\\nclass ApiClient {\\n  static ApiClient? _instance;\\n  late final Dio _dio;\\n\\n  ApiClient._internal() {\\n    _dio = Dio(BaseOptions(\\n      baseUrl: const String.fromEnvironment(\\n        'API_BASE_URL',\\n        defaultValue: 'https://api.example.com/v1',\\n      ),\\n      connectTimeout: const Duration(seconds: 10),\\n      receiveTimeout: const Duration(seconds: 15),\\n      sendTimeout: const Duration(seconds: 10),\\n      headers: {\\n        'Content-Type': 'application/json',\\n        'Accept': 'application/json',\\n      },\\n    ));\\n    _setupInterceptors();\\n  }\\n\\n  factory ApiClient() {\\n    _instance ??= ApiClient._internal();\\n    return _instance!;\\n  }\\n\\n  Dio get dio => _dio;\\n\\n  void _setupInterceptors() {\\n    // 다음 단계에서 구현\\n  }\\n}"
      },
      "commands": ["flutter pub add dio", "flutter pub add pretty_dio_logger"],
      "explanation": "싱글톤 패턴을 사용하는 이유는 Dio 인스턴스 생성 비용을 줄이고, 인터셉터와 설정을 앱 전체에서 일관되게 유지하기 위함입니다. String.fromEnvironment를 통해 빌드 시점에 환경을 주입받아 개발/스테이징/프로덕션 서버를 쉽게 전환할 수 있습니다."
    },
    {
      "stepNumber": 2,
      "title": "인터셉터 체인 구성: 인증, 로깅, 에러 핸들링",
      "description": "실무에서 가장 중요한 인터셉터 3종 세트를 구현합니다. 모든 요청에 자동으로 토큰을 주입하고, 401 에러 시 토큰 갱신 후 재시도하며, 상세한 로그를 남깁니다.",
      "substeps": [
        "AuthInterceptor: JWT 토큰 자동 주입 및 갱신",
        "LoggingInterceptor: 요청/응답 디버깅용 로그",
        "ErrorInterceptor: 공통 에러 처리 및 사용자 친화적 메시지 변환"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/core/network/interceptors/auth_interceptor.dart",
        "content": "import 'package:dio/dio.dart';\\n\\nclass AuthInterceptor extends Interceptor {\\n  final TokenStorage _tokenStorage;\\n  final Dio _dio;\\n  bool _isRefreshing = false;\\n\\n  AuthInterceptor(this._tokenStorage, this._dio);\\n\\n  @override\\n  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {\\n    final token = await _tokenStorage.getAccessToken();\\n    if (token != null) {\\n      options.headers['Authorization'] = 'Bearer \$token';\\n    }\\n    handler.next(options);\\n  }\\n\\n  @override\\n  void onError(DioException err, ErrorInterceptorHandler handler) async {\\n    if (err.response?.statusCode == 401 && !_isRefreshing) {\\n      _isRefreshing = true;\\n      try {\\n        final newToken = await _refreshToken();\\n        if (newToken != null) {\\n          err.requestOptions.headers['Authorization'] = 'Bearer \$newToken';\\n          final response = await _dio.fetch(err.requestOptions);\\n          handler.resolve(response);\\n          return;\\n        }\\n      } catch (e) {\\n        // 토큰 갱신 실패 시 로그아웃 처리\\n        await _tokenStorage.clear();\\n      } finally {\\n        _isRefreshing = false;\\n      }\\n    }\\n    handler.next(err);\\n  }\\n\\n  Future<String?> _refreshToken() async {\\n    final refreshToken = await _tokenStorage.getRefreshToken();\\n    if (refreshToken == null) return null;\\n    \\n    final response = await _dio.post('/auth/refresh', data: {\\n      'refresh_token': refreshToken,\\n    });\\n    \\n    final newAccessToken = response.data['access_token'];\\n    await _tokenStorage.saveAccessToken(newAccessToken);\\n    return newAccessToken;\\n  }\\n}"
      },
      "explanation": "_isRefreshing 플래그는 동시에 여러 요청이 401을 받았을 때 토큰 갱신이 중복 실행되는 것을 방지합니다. 이 패턴 없이는 3개의 API가 동시에 실패하면 토큰 갱신도 3번 시도되어 race condition이 발생합니다. fetch() 메서드로 원래 요청을 재시도하면 사용자는 401 에러를 전혀 인지하지 못하고 자연스럽게 서비스를 이용할 수 있습니다.",
      "note": "토큰 갱신 중 다른 요청들을 큐에 넣고 갱신 완료 후 일괄 재시도하는 고급 패턴도 있습니다. QueuedInterceptor를 상속받아 구현할 수 있습니다."
    },
    {
      "stepNumber": 3,
      "title": "Repository 패턴으로 API 호출 추상화",
      "description": "Dio를 직접 호출하지 않고 Repository 레이어를 통해 비즈니스 로직과 네트워크 레이어를 분리합니다. 이를 통해 테스트가 용이해지고 API 변경 시 영향 범위를 최소화할 수 있습니다.",
      "substeps": [
        "제네릭 ApiResponse 래퍼 클래스 정의",
        "Repository 추상 클래스와 구현체 분리",
        "Either 패턴으로 성공/실패 명시적 처리"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/features/user/data/repositories/user_repository_impl.dart",
        "content": "import 'package:dio/dio.dart';\\n\\nabstract class UserRepository {\\n  Future<Result<User>> getProfile();\\n  Future<Result<void>> updateProfile(UpdateProfileRequest request);\\n}\\n\\nclass UserRepositoryImpl implements UserRepository {\\n  final ApiClient _apiClient;\\n\\n  UserRepositoryImpl(this._apiClient);\\n\\n  @override\\n  Future<Result<User>> getProfile() async {\\n    try {\\n      final response = await _apiClient.dio.get('/users/me');\\n      final user = User.fromJson(response.data);\\n      return Result.success(user);\\n    } on DioException catch (e) {\\n      return Result.failure(_mapDioError(e));\\n    }\\n  }\\n\\n  @override\\n  Future<Result<void>> updateProfile(UpdateProfileRequest request) async {\\n    try {\\n      await _apiClient.dio.put('/users/me', data: request.toJson());\\n      return Result.success(null);\\n    } on DioException catch (e) {\\n      return Result.failure(_mapDioError(e));\\n    }\\n  }\\n\\n  AppException _mapDioError(DioException e) {\\n    switch (e.type) {\\n      case DioExceptionType.connectionTimeout:\\n      case DioExceptionType.sendTimeout:\\n      case DioExceptionType.receiveTimeout:\\n        return NetworkException('서버 응답이 지연되고 있습니다');\\n      case DioExceptionType.connectionError:\\n        return NetworkException('인터넷 연결을 확인해주세요');\\n      default:\\n        final statusCode = e.response?.statusCode;\\n        final message = e.response?.data?['message'] ?? '알 수 없는 오류';\\n        return ServerException(statusCode ?? 500, message);\\n    }\\n  }\\n}\\n\\n// Result 클래스 (sealed class 활용)\\nsealed class Result<T> {\\n  const Result();\\n  factory Result.success(T data) = Success<T>;\\n  factory Result.failure(AppException error) = Failure<T>;\\n}\\n\\nclass Success<T> extends Result<T> {\\n  final T data;\\n  const Success(this.data);\\n}\\n\\nclass Failure<T> extends Result<T> {\\n  final AppException error;\\n  const Failure(this.error);\\n}"
      },
      "explanation": "Repository 패턴의 핵심 가치는 '관심사의 분리'입니다. ViewModel이나 Bloc에서는 네트워크 에러의 종류(timeout, connection error 등)를 알 필요 없이, Result.success 또는 Result.failure만 처리하면 됩니다. Dart 3의 sealed class를 활용하면 switch문에서 모든 케이스를 강제로 처리하게 되어 누락 없는 에러 핸들링이 가능합니다."
    },
    {
      "stepNumber": 4,
      "title": "파일 업로드와 다운로드 진행률 표시",
      "description": "대용량 파일 처리 시 사용자에게 진행 상황을 실시간으로 보여주는 UX를 구현합니다. MultipartFile과 onSendProgress/onReceiveProgress 콜백을 활용합니다.",
      "substeps": [
        "이미지/파일 업로드 with 진행률",
        "파일 다운로드 with 로컬 저장",
        "업로드 취소 기능 구현"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/core/network/file_service.dart",
        "content": "import 'dart:io';\\nimport 'package:dio/dio.dart';\\nimport 'package:path_provider/path_provider.dart';\\n\\nclass FileService {\\n  final ApiClient _apiClient;\\n  CancelToken? _uploadCancelToken;\\n\\n  FileService(this._apiClient);\\n\\n  Future<String> uploadImage({\\n    required File file,\\n    required void Function(int sent, int total) onProgress,\\n  }) async {\\n    _uploadCancelToken = CancelToken();\\n    \\n    final fileName = file.path.split('/').last;\\n    final formData = FormData.fromMap({\\n      'file': await MultipartFile.fromFile(\\n        file.path,\\n        filename: fileName,\\n      ),\\n      'type': 'profile_image',\\n    });\\n\\n    final response = await _apiClient.dio.post(\\n      '/upload',\\n      data: formData,\\n      cancelToken: _uploadCancelToken,\\n      onSendProgress: onProgress,\\n      options: Options(\\n        headers: {'Content-Type': 'multipart/form-data'},\\n        sendTimeout: const Duration(minutes: 5),\\n      ),\\n    );\\n\\n    return response.data['url'];\\n  }\\n\\n  void cancelUpload() {\\n    _uploadCancelToken?.cancel('사용자가 업로드를 취소했습니다');\\n  }\\n\\n  Future<File> downloadFile({\\n    required String url,\\n    required String filename,\\n    required void Function(int received, int total) onProgress,\\n  }) async {\\n    final dir = await getApplicationDocumentsDirectory();\\n    final savePath = '\${dir.path}/\$filename';\\n\\n    await _apiClient.dio.download(\\n      url,\\n      savePath,\\n      onReceiveProgress: (received, total) {\\n        if (total != -1) {\\n          onProgress(received, total);\\n        }\\n      },\\n    );\\n\\n    return File(savePath);\\n  }\\n}"
      },
      "explanation": "CancelToken을 클래스 필드로 저장해두면 업로드 중 사용자가 화면을 벗어나거나 취소 버튼을 눌렀을 때 즉시 요청을 중단할 수 있습니다. 이는 불필요한 네트워크 트래픽과 서버 부하를 줄이는 중요한 최적화입니다. download() 메서드의 total이 -1인 경우는 서버가 Content-Length 헤더를 보내지 않는 경우이므로 이를 체크해야 합니다."
    },
    {
      "stepNumber": 5,
      "title": "테스트를 위한 Mock 설정",
      "description": "Dio의 HttpClientAdapter를 교체하여 실제 네트워크 호출 없이 API 응답을 시뮬레이션합니다. 단위 테스트와 위젯 테스트에서 일관된 결과를 보장합니다.",
      "substeps": [
        "MockAdapter 클래스 생성",
        "테스트별 응답 시나리오 정의",
        "에러 케이스 테스트 작성"
      ],
      "code": {
        "language": "dart",
        "filename": "test/mocks/mock_dio_adapter.dart",
        "content": "import 'dart:convert';\\nimport 'package:dio/dio.dart';\\n\\nclass MockDioAdapter implements HttpClientAdapter {\\n  final Map<String, MockResponse> _responses = {};\\n\\n  void onGet(String path, MockResponse response) {\\n    _responses['GET:\$path'] = response;\\n  }\\n\\n  void onPost(String path, MockResponse response) {\\n    _responses['POST:\$path'] = response;\\n  }\\n\\n  @override\\n  Future<ResponseBody> fetch(\\n    RequestOptions options,\\n    Stream<Uint8List>? requestStream,\\n    Future<void>? cancelFuture,\\n  ) async {\\n    final key = '\${options.method}:\${options.path}';\\n    final mockResponse = _responses[key];\\n\\n    if (mockResponse == null) {\\n      throw DioException(\\n        requestOptions: options,\\n        error: 'No mock response for \$key',\\n      );\\n    }\\n\\n    if (mockResponse.delay != null) {\\n      await Future.delayed(mockResponse.delay!);\\n    }\\n\\n    if (mockResponse.exception != null) {\\n      throw mockResponse.exception!;\\n    }\\n\\n    return ResponseBody.fromString(\\n      jsonEncode(mockResponse.data),\\n      mockResponse.statusCode,\\n      headers: {\\n        'content-type': ['application/json'],\\n      },\\n    );\\n  }\\n\\n  @override\\n  void close({bool force = false}) {}\\n}\\n\\nclass MockResponse {\\n  final int statusCode;\\n  final dynamic data;\\n  final Duration? delay;\\n  final DioException? exception;\\n\\n  MockResponse({\\n    this.statusCode = 200,\\n    this.data,\\n    this.delay,\\n    this.exception,\\n  });\\n}"
      },
      "explanation": "실제 테스트에서는 dio.httpClientAdapter = MockDioAdapter()로 교체하여 사용합니다. delay 옵션을 활용하면 느린 네트워크 상황을 시뮬레이션하여 로딩 UI가 제대로 표시되는지 테스트할 수 있고, exception 옵션으로 다양한 에러 시나리오를 검증할 수 있습니다."
    }
  ],
  "commonErrors": [
    {
      "error": "SocketException: Connection refused",
      "solution": "Android 에뮬레이터에서 localhost 접근 시 발생합니다. localhost 대신 10.0.2.2를 사용하세요. iOS 시뮬레이터는 localhost 그대로 사용 가능합니다."
    },
    {
      "error": "DioException [bad response]: 서버가 HTML을 반환",
      "solution": "API 엔드포인트가 잘못되었거나 서버가 에러 페이지를 반환하는 경우입니다. baseUrl과 path가 올바른지, 서버 로그를 확인하세요."
    },
    {
      "error": "HandshakeException: CERTIFICATE_VERIFY_FAILED",
      "solution": "자체 서명 인증서 사용 시 발생합니다. 개발 환경에서만 badCertificateCallback으로 우회하고, 프로덕션에서는 절대 사용하지 마세요."
    }
  ],
  "tips": [
    "Dio 인스턴스를 여러 개 만들지 마세요. 각 인스턴스는 별도의 커넥션 풀을 유지하므로 메모리 낭비입니다. 필요하다면 copyWith()로 설정만 다르게 하세요.",
    "큰 JSON 응답을 파싱할 때는 compute() 함수로 별도 Isolate에서 처리하면 UI 프레임 드롭을 방지할 수 있습니다.",
    "재시도 로직은 dio_smart_retry 패키지를 활용하면 지수 백오프(exponential backoff)를 쉽게 구현할 수 있습니다."
  ],
  "nextSteps": [
    {
      "title": "Retrofit으로 타입 안전한 API 클라이언트",
      "description": "retrofit 패키지와 함께 사용하면 API 엔드포인트를 어노테이션으로 선언하고 코드 제너레이션으로 boilerplate를 제거할 수 있습니다."
    },
    {
      "title": "GraphQL 지원",
      "description": "graphql_flutter와 함께 dio를 HTTP 링크로 사용하여 GraphQL 쿼리에도 인터셉터 기반 인증을 적용할 수 있습니다."
    }
  ],
  "references": [
    { "title": "Dio 공식 문서", "url": "https://pub.dev/packages/dio" },
    { "title": "Flutter Dio 베스트 프랙티스", "url": "https://medium.com/flutter-community" }
  ]
}
\`\`\`

위 예시의 핵심 특징:
1. **Step 1은 설치+초기화를 한 번에** - 설치만 하는 단계 없음
2. **각 단계는 실제 실무 패턴** - 인터셉터, Repository 패턴, 파일 업로드 등
3. **코드는 바로 복사해서 쓸 수 있는 완성도** - 클래스 전체, import문 포함
4. **explanation은 "왜" 이렇게 하는지 설명** - 단순 "이렇게 합니다"가 아님
5. **commonErrors는 실제 현업에서 만나는 에러** - 초보적 에러 X`;

  return `당신은 15년 차 시니어 Flutter/Dart 아키텍트이자 기술 교육 전문가입니다.

${fewShotExample}

---

## 이제 아래 패키지에 대해 위 예시와 동일한 수준의 가이드를 작성하세요.

### 대상 패키지 정보
- **이름**: ${pkg.name}
- **버전**: ${pkg.version || 'latest'}
- **설명**: ${pkg.description || '정보 없음'}
- **지원 플랫폼**: ${(pkg.platforms || []).join(', ') || 'all'}
${exampleSection}

## ⚠️ 필수 작성 규칙

### 1. 단계 구성 (최소 4단계, 최대 6단계)
- **Step 1**: 설치 + 초기 설정을 하나로 통합 (싱글톤 패턴, 전역 설정 등 포함)
- **Step 2-3**: 패키지의 핵심 기능을 실제 앱 구조에 적용하는 방법
- **Step 4+**: 고급 활용법, 에러 핸들링, 성능 최적화, 테스트 등

### 2. 코드 품질
- 모든 code.content는 **바로 복사해서 동작하는 완전한 코드**
- import문, 클래스 전체, 필요한 모든 메서드 포함
- 최소 30줄 이상의 실질적인 코드 (한두 줄 snippet 금지)

### 3. 설명 깊이
- explanation은 "왜 이 방식인지", "현업에서 어떻게 쓰이는지" 맥락 설명
- note는 흔한 실수, 성능 팁, 대안적 접근법 제시

### 4. 실무 에러
- commonErrors는 Stack Overflow에서 자주 검색되는 실제 에러
- 초보적인 문법 에러가 아닌 환경/설정/통합 관련 에러

### 5. 출력 형식
- 반드시 순수 JSON만 출력 (마크다운 코드블록 없이)
- 위 예시와 동일한 JSON 구조 유지

이제 "${pkg.name}" 패키지에 대한 프로덕션 레벨 구현 가이드를 JSON으로 출력하세요:`;
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
 * Fallback 가이드 생성 - 개선된 버전
 */
function createFallbackGuide(pkg, exampleCode) {
  const steps = [
    {
      stepNumber: 1,
      title: '프로젝트 설정 및 초기화',
      description: `${pkg.name} 패키지를 프로젝트에 추가하고 기본 설정을 구성합니다. CLI를 통한 설치가 가장 권장되며, 버전 충돌을 방지하기 위해 명시적 버전을 사용합니다.`,
      substeps: [
        'flutter pub add 명령어로 패키지 설치',
        'pubspec.yaml에서 버전 확인',
        '필요한 경우 추가 설정 파일 구성'
      ],
      code: {
        language: 'dart',
        filename: 'lib/core/config/${pkg.name}_config.dart',
        content: `// ${pkg.name} 패키지 설정 및 초기화
import 'package:${pkg.name}/${pkg.name}.dart';

/// ${pkg.name} 전역 설정 클래스
/// 앱 시작 시 한 번만 초기화하여 사용합니다.
class ${toPascalCase(pkg.name)}Config {
  static ${toPascalCase(pkg.name)}Config? _instance;

  ${toPascalCase(pkg.name)}Config._internal();

  factory ${toPascalCase(pkg.name)}Config() {
    _instance ??= ${toPascalCase(pkg.name)}Config._internal();
    return _instance!;
  }

  /// 패키지 초기화
  /// main.dart의 main() 함수에서 호출하세요.
  Future<void> initialize() async {
    // TODO: 패키지별 초기화 로직 구현
    // 공식 문서를 참고하여 필요한 설정을 추가하세요.
  }
}`,
      },
      commands: [`flutter pub add ${pkg.name}`],
      explanation: `싱글톤 패턴으로 설정을 관리하면 앱 전체에서 일관된 설정을 유지할 수 있습니다. 초기화 로직을 별도 클래스로 분리하면 테스트와 유지보수가 용이해집니다.`,
    },
  ];

  // exampleCode가 있으면 분석하여 더 나은 단계 생성
  if (exampleCode && exampleCode.length > 100) {
    steps.push({
      stepNumber: 2,
      title: '핵심 기능 구현',
      description: `${pkg.name}의 주요 기능을 실제 앱에 통합합니다. 아래 공식 예제 코드를 기반으로 프로젝트 구조에 맞게 커스터마이징하세요.`,
      substeps: [
        '공식 예제 코드 분석',
        '프로젝트 아키텍처에 맞게 구조화',
        '에러 핸들링 추가'
      ],
      code: {
        language: 'dart',
        filename: 'lib/features/example_usage.dart',
        content: exampleCode.substring(0, 1500),
      },
      explanation: '공식 예제는 기본적인 사용법을 보여줍니다. 실무에서는 이를 Repository 패턴이나 Service 레이어로 감싸서 사용하는 것이 좋습니다.',
      note: '예제 코드를 그대로 복사하지 말고, 프로젝트의 코딩 컨벤션과 아키텍처에 맞게 수정하세요.',
    });

    steps.push({
      stepNumber: 3,
      title: '에러 핸들링 및 예외 처리',
      description: '프로덕션 환경에서 안정적인 동작을 위해 적절한 에러 핸들링을 구현합니다.',
      substeps: [
        'try-catch로 예외 상황 처리',
        '사용자 친화적 에러 메시지 정의',
        '로깅 및 에러 리포팅 연동'
      ],
      code: {
        language: 'dart',
        filename: 'lib/core/error/package_exception.dart',
        content: `/// ${pkg.name} 관련 예외 처리 클래스
class ${toPascalCase(pkg.name)}Exception implements Exception {
  final String message;
  final dynamic originalError;
  final StackTrace? stackTrace;

  ${toPascalCase(pkg.name)}Exception(
    this.message, {
    this.originalError,
    this.stackTrace,
  });

  @override
  String toString() => '${toPascalCase(pkg.name)}Exception: \$message';

  /// 사용자에게 보여줄 메시지
  String get userMessage {
    // TODO: 에러 유형별 사용자 친화적 메시지 정의
    return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
}

/// 예외 처리 유틸리티
Future<T> safeguard<T>(Future<T> Function() action) async {
  try {
    return await action();
  } catch (e, st) {
    throw ${toPascalCase(pkg.name)}Exception(
      e.toString(),
      originalError: e,
      stackTrace: st,
    );
  }
}`,
      },
      explanation: '커스텀 예외 클래스를 사용하면 패키지 관련 에러를 일관되게 처리할 수 있습니다. safeguard 함수는 반복되는 try-catch 보일러플레이트를 줄여줍니다.',
    });
  } else {
    steps.push({
      stepNumber: 2,
      title: '기본 사용법',
      description: `${pkg.name} 패키지의 기본 사용법입니다. 공식 문서를 참고하여 상세한 옵션을 확인하세요.`,
      substeps: [
        '패키지 import',
        '기본 인스턴스 생성',
        '주요 메서드 호출'
      ],
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
      home: const ExampleScreen(),
    );
  }
}

class ExampleScreen extends StatefulWidget {
  const ExampleScreen({super.key});

  @override
  State<ExampleScreen> createState() => _ExampleScreenState();
}

class _ExampleScreenState extends State<ExampleScreen> {
  @override
  void initState() {
    super.initState();
    // TODO: ${pkg.name} 초기화 로직
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${pkg.name} Example')),
      body: const Center(
        child: Text('구현을 시작하세요!'),
      ),
    );
  }
}`,
      },
      explanation: '위 코드는 기본 앱 구조입니다. TODO 주석 부분에 패키지 초기화 및 사용 로직을 추가하세요.',
    });
  }

  return {
    packageId: pkg.name,
    title: `${pkg.name} 구현 가이드`,
    description: pkg.description || `${pkg.name} 패키지를 Flutter 프로젝트에 통합하는 방법을 안내합니다.`,
    difficulty: '중급',
    estimatedTime: '30분-1시간',
    prerequisites: [
      'Flutter SDK 설치 및 기본 프로젝트 생성',
      'Dart 비동기 프로그래밍 (async/await) 이해',
      'StatefulWidget 라이프사이클 이해'
    ],
    steps,
    commonErrors: [
      {
        error: 'MissingPluginException',
        solution: '네이티브 플러그인이 제대로 로드되지 않은 경우입니다. flutter clean 후 flutter pub get을 실행하고, 앱을 완전히 재시작하세요.'
      },
      {
        error: 'Version solving failed',
        solution: '다른 패키지와 버전 충돌이 발생했습니다. flutter pub deps를 실행하여 의존성 트리를 확인하고, 호환되는 버전을 찾으세요.'
      }
    ],
    tips: [
      `${pkg.name}의 공식 예제 코드를 꼭 확인하세요. 대부분의 일반적인 사용 사례가 포함되어 있습니다.`,
      'GitHub Issues에서 다른 개발자들의 질문과 해결책을 참고하면 도움이 됩니다.',
      '패키지 버전 업데이트 시 CHANGELOG를 확인하여 breaking changes를 파악하세요.'
    ],
    nextSteps: [
      {
        title: '고급 기능 탐색',
        description: '공식 문서의 Advanced 섹션을 참고하여 추가 기능을 활용해보세요.'
      },
      {
        title: '테스트 작성',
        description: '패키지 기능에 대한 단위 테스트와 위젯 테스트를 작성하여 안정성을 확보하세요.'
      }
    ],
    references: [
      { title: '공식 문서', url: `https://pub.dev/packages/${pkg.name}` },
      { title: 'GitHub Repository', url: `https://github.com/search?q=${pkg.name}+flutter` },
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

// 이전 함수명 호환성 유지
export { generateGuide as generateGuideFromPubDev };
