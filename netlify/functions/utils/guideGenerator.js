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
 * Gemini 프롬프트 구성 - 초심자 친화적 + 고급 가이드
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

  // Few-shot 예시: 초심자도 이해할 수 있는 고품질 가이드
  const fewShotExample = `
## 🎯 모범 가이드 예시 (이 수준과 분량으로 작성하세요)

다음은 "provider" 패키지에 대한 모범 가이드입니다. **초심자도 이해할 수 있으면서 고급 패턴까지 다루는** 이 품질과 분량을 참고하세요:

\`\`\`json
{
  "packageId": "provider",
  "title": "Provider 완벽 마스터: Flutter 상태 관리의 정석",
  "description": "Provider는 Flutter 공식 권장 상태 관리 솔루션입니다. 위젯 트리를 통해 데이터를 효율적으로 전달하고, 변경 시 필요한 위젯만 다시 그립니다. 이 가이드에서는 기초 개념부터 실무 아키텍처까지 단계별로 배웁니다.",
  "difficulty": "초급 → 고급",
  "estimatedTime": "3-4시간",
  "prerequisites": [
    "Flutter 위젯 기초 (StatelessWidget, StatefulWidget의 차이)",
    "Dart 클래스와 생성자 문법",
    "BuildContext가 무엇인지 기본 이해"
  ],
  "coreConcepts": [
    {
      "term": "상태(State)란?",
      "explanation": "앱에서 변할 수 있는 모든 데이터입니다. 예: 로그인한 사용자 정보, 장바구니 아이템, 다크모드 설정 등. 상태가 변하면 화면도 그에 맞게 업데이트되어야 합니다.",
      "analogy": "TV 리모컨의 볼륨 버튼을 누르면 TV 화면에 볼륨 바가 표시되는 것처럼, 앱의 상태가 변하면 UI도 자동으로 반영됩니다."
    },
    {
      "term": "Provider란?",
      "explanation": "위젯 트리의 상위에서 데이터를 '제공(Provide)'하면, 하위의 어떤 위젯에서든 그 데이터를 '소비(Consume)'할 수 있게 해주는 패키지입니다. props drilling(부모→자식→손자로 계속 데이터 전달) 문제를 해결합니다.",
      "analogy": "회사의 공지사항 게시판과 같습니다. 사장님이 게시판에 공지를 올리면(provide), 모든 직원이 자기 자리에서 볼 수 있습니다(consume). 일일이 전달할 필요가 없죠."
    },
    {
      "term": "ChangeNotifier란?",
      "explanation": "상태가 변경되었음을 알려주는 클래스입니다. notifyListeners()를 호출하면 이 상태를 구독하는 모든 위젯에게 '다시 그려!'라고 신호를 보냅니다.",
      "analogy": "카톡 단체방에서 메시지를 보내면 모든 멤버에게 알림이 가는 것과 같습니다."
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "title": "프로젝트 설정 및 Provider 기본 구조 이해",
      "description": "Provider 패키지를 설치하고, 앱 전체에서 사용할 수 있도록 설정합니다. 가장 기본적인 Provider 사용법을 익힙니다.",
      "whatYouWillLearn": [
        "Provider 패키지 설치 방법",
        "ChangeNotifierProvider의 역할",
        "context.watch와 context.read의 차이"
      ],
      "substeps": [
        "터미널에서 flutter pub add provider 실행",
        "main.dart에서 MaterialApp을 Provider로 감싸기",
        "상태 클래스(ChangeNotifier) 만들기"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/main.dart",
        "content": "import 'package:flutter/material.dart';\\nimport 'package:provider/provider.dart';\\n\\n// ✅ Step 1: 상태를 관리할 클래스를 만듭니다\\n// ChangeNotifier를 상속받으면 상태 변경을 알릴 수 있습니다\\nclass CounterState extends ChangeNotifier {\\n  // 내부에서만 수정 가능하도록 private 변수 사용 (_count)\\n  int _count = 0;\\n  \\n  // 외부에서는 읽기만 가능 (getter)\\n  int get count => _count;\\n  \\n  // 상태를 변경하는 메서드\\n  void increment() {\\n    _count++;  // 값 변경\\n    notifyListeners();  // 🔔 '나 변경됐어!' 하고 알림\\n  }\\n  \\n  void decrement() {\\n    if (_count > 0) _count--;\\n    notifyListeners();\\n  }\\n  \\n  void reset() {\\n    _count = 0;\\n    notifyListeners();\\n  }\\n}\\n\\nvoid main() {\\n  runApp(\\n    // ✅ Step 2: 앱 전체를 Provider로 감쌉니다\\n    // 이렇게 하면 앱 어디서든 CounterState에 접근 가능\\n    ChangeNotifierProvider(\\n      // create: Provider가 관리할 상태 객체를 생성\\n      create: (context) => CounterState(),\\n      child: const MyApp(),\\n    ),\\n  );\\n}\\n\\nclass MyApp extends StatelessWidget {\\n  const MyApp({super.key});\\n\\n  @override\\n  Widget build(BuildContext context) {\\n    return MaterialApp(\\n      title: 'Provider Demo',\\n      theme: ThemeData(primarySwatch: Colors.blue),\\n      home: const CounterScreen(),\\n    );\\n  }\\n}\\n\\nclass CounterScreen extends StatelessWidget {\\n  const CounterScreen({super.key});\\n\\n  @override\\n  Widget build(BuildContext context) {\\n    // ✅ Step 3: 상태 사용하기\\n    // context.watch: 상태가 변하면 이 위젯을 다시 그림\\n    final counterState = context.watch<CounterState>();\\n    \\n    return Scaffold(\\n      appBar: AppBar(title: const Text('Provider 카운터')),\\n      body: Center(\\n        child: Column(\\n          mainAxisAlignment: MainAxisAlignment.center,\\n          children: [\\n            const Text('버튼을 누른 횟수:', style: TextStyle(fontSize: 18)),\\n            const SizedBox(height: 8),\\n            // counterState.count가 변하면 자동으로 업데이트됨\\n            Text(\\n              '\${counterState.count}',\\n              style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold),\\n            ),\\n          ],\\n        ),\\n      ),\\n      floatingActionButton: Column(\\n        mainAxisAlignment: MainAxisAlignment.end,\\n        children: [\\n          FloatingActionButton(\\n            onPressed: () {\\n              // context.read: 상태를 읽기만 함 (리빌드 안 함)\\n              // 버튼 클릭 같은 이벤트에서는 read 사용\\n              context.read<CounterState>().increment();\\n            },\\n            child: const Icon(Icons.add),\\n          ),\\n          const SizedBox(height: 8),\\n          FloatingActionButton(\\n            onPressed: () => context.read<CounterState>().decrement(),\\n            child: const Icon(Icons.remove),\\n          ),\\n        ],\\n      ),\\n    );\\n  }\\n}"
      },
      "commands": ["flutter pub add provider"],
      "explanation": "이 코드의 핵심은 '관심사의 분리'입니다. CounterState 클래스는 '카운터 로직'만 담당하고, CounterScreen은 '화면 그리기'만 담당합니다. 상태와 UI가 분리되면 코드 수정이 쉬워지고, 테스트도 간편해집니다.",
      "beginnerTip": "context.watch vs context.read가 헷갈리시나요? 쉽게 기억하세요: UI에 값을 '보여줄 때'는 watch (변경 감시), 버튼 클릭으로 '행동할 때'는 read (그냥 읽기)",
      "commonMistake": "build() 메서드 안에서 context.read()로 상태를 읽으면 상태가 변해도 화면이 업데이트되지 않습니다. UI에 표시할 값은 반드시 watch()를 사용하세요."
    },
    {
      "stepNumber": 2,
      "title": "Consumer 위젯으로 성능 최적화하기",
      "description": "context.watch를 사용하면 전체 위젯이 다시 그려집니다. Consumer를 사용하면 필요한 부분만 다시 그릴 수 있어 성능이 향상됩니다.",
      "whatYouWillLearn": [
        "Consumer 위젯의 역할과 사용법",
        "Selector로 특정 값만 구독하기",
        "불필요한 리빌드 방지하는 방법"
      ],
      "substeps": [
        "Consumer 위젯으로 부분 업데이트 구현",
        "Selector로 필요한 속성만 구독",
        "리빌드 범위 시각적으로 확인하기"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/screens/optimized_counter_screen.dart",
        "content": "import 'package:flutter/material.dart';\\nimport 'package:provider/provider.dart';\\n\\n// 더 복잡한 상태 예시\\nclass ShoppingCartState extends ChangeNotifier {\\n  final List<String> _items = [];\\n  int _totalPrice = 0;\\n  \\n  List<String> get items => List.unmodifiable(_items);\\n  int get totalPrice => _totalPrice;\\n  int get itemCount => _items.length;\\n  \\n  void addItem(String item, int price) {\\n    _items.add(item);\\n    _totalPrice += price;\\n    notifyListeners();\\n  }\\n  \\n  void clear() {\\n    _items.clear();\\n    _totalPrice = 0;\\n    notifyListeners();\\n  }\\n}\\n\\nclass OptimizedCartScreen extends StatelessWidget {\\n  const OptimizedCartScreen({super.key});\\n\\n  @override\\n  Widget build(BuildContext context) {\\n    print('🔄 전체 화면 빌드됨');  // 디버깅용\\n    \\n    return Scaffold(\\n      appBar: AppBar(\\n        title: const Text('장바구니'),\\n        // ✅ 방법 1: Consumer - 특정 영역만 리빌드\\n        // AppBar의 다른 부분은 그대로, 아이템 개수만 업데이트\\n        actions: [\\n          Consumer<ShoppingCartState>(\\n            builder: (context, cart, child) {\\n              print('🔄 장바구니 아이콘만 빌드됨');\\n              return Badge(\\n                label: Text('\${cart.itemCount}'),\\n                child: const Icon(Icons.shopping_cart),\\n              );\\n            },\\n          ),\\n          const SizedBox(width: 16),\\n        ],\\n      ),\\n      body: Column(\\n        children: [\\n          // ✅ 방법 2: Selector - 특정 값이 변할 때만 리빌드\\n          // totalPrice만 변해도 itemCount 위젯은 리빌드 안 됨\\n          Selector<ShoppingCartState, int>(\\n            selector: (context, cart) => cart.totalPrice,\\n            builder: (context, totalPrice, child) {\\n              print('🔄 총액만 빌드됨');\\n              return Container(\\n                padding: const EdgeInsets.all(16),\\n                color: Colors.blue.shade50,\\n                child: Row(\\n                  mainAxisAlignment: MainAxisAlignment.spaceBetween,\\n                  children: [\\n                    const Text('총 금액', style: TextStyle(fontSize: 18)),\\n                    Text(\\n                      '₩\${totalPrice.toString().replaceAllMapped(RegExp(r'(\\\\d{1,3})(?=(\\\\d{3})+(?!\\\\d))'), (m) => '\${m[1]},')}',\\n                      style: const TextStyle(\\n                        fontSize: 24,\\n                        fontWeight: FontWeight.bold,\\n                        color: Colors.blue,\\n                      ),\\n                    ),\\n                  ],\\n                ),\\n              );\\n            },\\n          ),\\n          \\n          // 아이템 목록\\n          Expanded(\\n            child: Consumer<ShoppingCartState>(\\n              builder: (context, cart, child) {\\n                print('🔄 아이템 목록만 빌드됨');\\n                if (cart.items.isEmpty) {\\n                  return const Center(\\n                    child: Text('장바구니가 비어있습니다'),\\n                  );\\n                }\\n                return ListView.builder(\\n                  itemCount: cart.items.length,\\n                  itemBuilder: (context, index) {\\n                    return ListTile(\\n                      leading: const Icon(Icons.check_circle),\\n                      title: Text(cart.items[index]),\\n                    );\\n                  },\\n                );\\n              },\\n            ),\\n          ),\\n        ],\\n      ),\\n      floatingActionButton: FloatingActionButton.extended(\\n        onPressed: () {\\n          // 샘플 아이템 추가\\n          final items = ['사과', '바나나', '오렌지', '포도'];\\n          final prices = [1000, 1500, 2000, 3000];\\n          final index = DateTime.now().millisecond % 4;\\n          context.read<ShoppingCartState>().addItem(items[index], prices[index]);\\n        },\\n        icon: const Icon(Icons.add),\\n        label: const Text('아이템 추가'),\\n      ),\\n    );\\n  }\\n}"
      },
      "explanation": "Consumer와 Selector는 '구독 범위'를 제한합니다. 전체 화면을 context.watch로 구독하면 어떤 상태가 변해도 전체가 다시 그려집니다. 하지만 Consumer나 Selector를 사용하면 해당 영역만 다시 그려져 성능이 향상됩니다. 특히 리스트가 길거나 복잡한 UI에서 차이가 큽니다.",
      "beginnerTip": "처음에는 context.watch로 시작하세요. 앱이 느려지면 그때 Consumer로 최적화하면 됩니다. 조기 최적화는 오히려 코드를 복잡하게 만듭니다.",
      "note": "print 문으로 어떤 위젯이 리빌드되는지 확인할 수 있습니다. 개발 중에는 이 방법으로 불필요한 리빌드를 찾아 최적화하세요."
    },
    {
      "stepNumber": 3,
      "title": "MultiProvider로 여러 상태 관리하기",
      "description": "실제 앱에서는 사용자 정보, 설정, 장바구니 등 여러 상태가 필요합니다. MultiProvider로 여러 상태를 깔끔하게 관리하는 방법을 배웁니다.",
      "whatYouWillLearn": [
        "MultiProvider 사용법",
        "상태 간 의존성 처리 (ProxyProvider)",
        "실무에서 자주 쓰는 폴더 구조"
      ],
      "substeps": [
        "여러 ChangeNotifier 클래스 분리",
        "MultiProvider로 한 번에 등록",
        "ProxyProvider로 상태 간 연결"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/main.dart",
        "content": "import 'package:flutter/material.dart';\\nimport 'package:provider/provider.dart';\\n\\n// ========== 상태 클래스들 ==========\\n\\n/// 사용자 인증 상태\\nclass AuthState extends ChangeNotifier {\\n  String? _userId;\\n  String? _userName;\\n  bool _isLoggedIn = false;\\n  \\n  bool get isLoggedIn => _isLoggedIn;\\n  String? get userId => _userId;\\n  String? get userName => _userName;\\n  \\n  Future<void> login(String email, String password) async {\\n    // 실제로는 API 호출\\n    await Future.delayed(const Duration(seconds: 1));\\n    _userId = 'user_123';\\n    _userName = email.split('@').first;\\n    _isLoggedIn = true;\\n    notifyListeners();\\n  }\\n  \\n  void logout() {\\n    _userId = null;\\n    _userName = null;\\n    _isLoggedIn = false;\\n    notifyListeners();\\n  }\\n}\\n\\n/// 앱 설정 상태\\nclass SettingsState extends ChangeNotifier {\\n  bool _isDarkMode = false;\\n  String _language = 'ko';\\n  \\n  bool get isDarkMode => _isDarkMode;\\n  String get language => _language;\\n  \\n  void toggleDarkMode() {\\n    _isDarkMode = !_isDarkMode;\\n    notifyListeners();\\n  }\\n  \\n  void setLanguage(String lang) {\\n    _language = lang;\\n    notifyListeners();\\n  }\\n}\\n\\n/// 장바구니 상태 (로그인 필요)\\nclass CartState extends ChangeNotifier {\\n  final AuthState _authState;  // 인증 상태에 의존\\n  final List<Map<String, dynamic>> _items = [];\\n  \\n  CartState(this._authState);\\n  \\n  List<Map<String, dynamic>> get items => List.unmodifiable(_items);\\n  \\n  int get totalPrice => _items.fold(0, (sum, item) => sum + (item['price'] as int));\\n  \\n  // 로그인된 사용자만 장바구니 사용 가능\\n  bool get canUseCart => _authState.isLoggedIn;\\n  \\n  void addItem(String name, int price) {\\n    if (!canUseCart) {\\n      throw Exception('로그인이 필요합니다');\\n    }\\n    _items.add({'name': name, 'price': price, 'userId': _authState.userId});\\n    notifyListeners();\\n  }\\n  \\n  void clear() {\\n    _items.clear();\\n    notifyListeners();\\n  }\\n}\\n\\n// ========== 앱 진입점 ==========\\n\\nvoid main() {\\n  runApp(\\n    // ✅ MultiProvider: 여러 Provider를 한 번에 등록\\n    MultiProvider(\\n      providers: [\\n        // 1. 독립적인 상태들 먼저\\n        ChangeNotifierProvider(create: (_) => AuthState()),\\n        ChangeNotifierProvider(create: (_) => SettingsState()),\\n        \\n        // 2. 다른 상태에 의존하는 상태는 ChangeNotifierProxyProvider 사용\\n        // AuthState가 변하면 CartState도 업데이트됨\\n        ChangeNotifierProxyProvider<AuthState, CartState>(\\n          create: (context) => CartState(context.read<AuthState>()),\\n          update: (context, authState, previousCart) {\\n            // 로그아웃하면 장바구니 비우기\\n            if (!authState.isLoggedIn) {\\n              previousCart?.clear();\\n            }\\n            return previousCart ?? CartState(authState);\\n          },\\n        ),\\n      ],\\n      child: const MyApp(),\\n    ),\\n  );\\n}\\n\\nclass MyApp extends StatelessWidget {\\n  const MyApp({super.key});\\n\\n  @override\\n  Widget build(BuildContext context) {\\n    // 설정 상태를 구독하여 다크모드 적용\\n    final settings = context.watch<SettingsState>();\\n    \\n    return MaterialApp(\\n      title: 'Multi Provider Demo',\\n      theme: settings.isDarkMode ? ThemeData.dark() : ThemeData.light(),\\n      home: const HomeScreen(),\\n    );\\n  }\\n}\\n\\nclass HomeScreen extends StatelessWidget {\\n  const HomeScreen({super.key});\\n\\n  @override\\n  Widget build(BuildContext context) {\\n    final auth = context.watch<AuthState>();\\n    \\n    return Scaffold(\\n      appBar: AppBar(\\n        title: Text(auth.isLoggedIn ? '안녕하세요, \${auth.userName}!' : '로그인하세요'),\\n        actions: [\\n          // 다크모드 토글\\n          IconButton(\\n            icon: Icon(\\n              context.watch<SettingsState>().isDarkMode\\n                  ? Icons.light_mode\\n                  : Icons.dark_mode,\\n            ),\\n            onPressed: () => context.read<SettingsState>().toggleDarkMode(),\\n          ),\\n          // 로그인/로그아웃\\n          IconButton(\\n            icon: Icon(auth.isLoggedIn ? Icons.logout : Icons.login),\\n            onPressed: () {\\n              if (auth.isLoggedIn) {\\n                context.read<AuthState>().logout();\\n              } else {\\n                context.read<AuthState>().login('user@example.com', 'password');\\n              }\\n            },\\n          ),\\n        ],\\n      ),\\n      body: Consumer<CartState>(\\n        builder: (context, cart, child) {\\n          if (!cart.canUseCart) {\\n            return const Center(\\n              child: Text('로그인하면 장바구니를 이용할 수 있습니다'),\\n            );\\n          }\\n          return ListView.builder(\\n            itemCount: cart.items.length,\\n            itemBuilder: (context, index) {\\n              final item = cart.items[index];\\n              return ListTile(\\n                title: Text(item['name']),\\n                trailing: Text('₩\${item['price']}'),\\n              );\\n            },\\n          );\\n        },\\n      ),\\n    );\\n  }\\n}"
      },
      "explanation": "실무에서는 기능별로 상태를 분리합니다. AuthState는 로그인만, SettingsState는 설정만, CartState는 장바구니만 담당합니다. 이렇게 하면 코드 수정 시 영향 범위가 줄어들고, 팀원들이 동시에 작업해도 충돌이 적습니다. ProxyProvider는 '이 상태는 저 상태에 의존해요'라고 명시적으로 선언하는 방법입니다.",
      "beginnerTip": "처음에는 모든 상태를 한 클래스에 넣고 싶을 수 있어요. 하지만 앱이 커지면 관리가 어려워집니다. 처음부터 기능별로 분리하는 습관을 들이세요.",
      "note": "Provider 등록 순서가 중요합니다! CartState가 AuthState에 의존하므로, AuthState를 먼저 등록해야 합니다."
    },
    {
      "stepNumber": 4,
      "title": "비동기 작업과 로딩/에러 상태 처리",
      "description": "API 호출 같은 비동기 작업 시 로딩 스피너를 보여주고, 에러가 발생하면 적절한 메시지를 표시하는 패턴을 구현합니다.",
      "whatYouWillLearn": [
        "비동기 상태 관리 패턴",
        "로딩, 성공, 에러 상태 분리",
        "사용자 친화적 에러 처리"
      ],
      "substeps": [
        "AsyncValue 패턴 구현",
        "try-catch로 에러 캡처",
        "상태별 UI 분기 처리"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/states/posts_state.dart",
        "content": "import 'package:flutter/material.dart';\\nimport 'package:provider/provider.dart';\\n\\n// ========== 상태 표현을 위한 클래스들 ==========\\n\\n/// 비동기 작업의 상태를 표현하는 제네릭 클래스\\n/// loading, success, error 세 가지 상태를 가질 수 있음\\nsealed class AsyncState<T> {\\n  const AsyncState();\\n}\\n\\nclass AsyncLoading<T> extends AsyncState<T> {\\n  const AsyncLoading();\\n}\\n\\nclass AsyncSuccess<T> extends AsyncState<T> {\\n  final T data;\\n  const AsyncSuccess(this.data);\\n}\\n\\nclass AsyncError<T> extends AsyncState<T> {\\n  final String message;\\n  final VoidCallback? retry;  // 재시도 콜백\\n  const AsyncError(this.message, {this.retry});\\n}\\n\\n// ========== 데이터 모델 ==========\\n\\nclass Post {\\n  final int id;\\n  final String title;\\n  final String body;\\n  \\n  Post({required this.id, required this.title, required this.body});\\n  \\n  factory Post.fromJson(Map<String, dynamic> json) {\\n    return Post(\\n      id: json['id'],\\n      title: json['title'],\\n      body: json['body'],\\n    );\\n  }\\n}\\n\\n// ========== 상태 관리 클래스 ==========\\n\\nclass PostsState extends ChangeNotifier {\\n  AsyncState<List<Post>> _state = const AsyncLoading();\\n  \\n  AsyncState<List<Post>> get state => _state;\\n  \\n  PostsState() {\\n    // 생성 시 자동으로 데이터 로드\\n    loadPosts();\\n  }\\n  \\n  Future<void> loadPosts() async {\\n    // 1. 로딩 상태로 변경\\n    _state = const AsyncLoading();\\n    notifyListeners();\\n    \\n    try {\\n      // 2. API 호출 (실제로는 http 패키지 사용)\\n      await Future.delayed(const Duration(seconds: 2));  // 네트워크 지연 시뮬레이션\\n      \\n      // 랜덤하게 에러 발생 시뮬레이션 (테스트용)\\n      if (DateTime.now().second % 3 == 0) {\\n        throw Exception('서버 연결에 실패했습니다');\\n      }\\n      \\n      // 성공 시 더미 데이터\\n      final posts = List.generate(\\n        10,\\n        (i) => Post(\\n          id: i + 1,\\n          title: '게시글 제목 \${i + 1}',\\n          body: '이것은 게시글 \${i + 1}의 내용입니다. 실제로는 서버에서 받아온 데이터가 표시됩니다.',\\n        ),\\n      );\\n      \\n      // 3. 성공 상태로 변경\\n      _state = AsyncSuccess(posts);\\n      notifyListeners();\\n      \\n    } catch (e) {\\n      // 4. 에러 상태로 변경 (재시도 버튼 포함)\\n      _state = AsyncError(\\n        e.toString(),\\n        retry: loadPosts,  // 재시도 시 이 함수 다시 호출\\n      );\\n      notifyListeners();\\n    }\\n  }\\n  \\n  /// 새로고침 (pull-to-refresh용)\\n  Future<void> refresh() async {\\n    await loadPosts();\\n  }\\n}\\n\\n// ========== UI ==========\\n\\nclass PostsScreen extends StatelessWidget {\\n  const PostsScreen({super.key});\\n\\n  @override\\n  Widget build(BuildContext context) {\\n    return Scaffold(\\n      appBar: AppBar(title: const Text('게시글 목록')),\\n      body: Consumer<PostsState>(\\n        builder: (context, postsState, child) {\\n          final state = postsState.state;\\n          \\n          // ✅ sealed class + switch로 모든 상태 처리 강제\\n          return switch (state) {\\n            // 로딩 중\\n            AsyncLoading() => const Center(\\n              child: Column(\\n                mainAxisAlignment: MainAxisAlignment.center,\\n                children: [\\n                  CircularProgressIndicator(),\\n                  SizedBox(height: 16),\\n                  Text('게시글을 불러오는 중...'),\\n                ],\\n              ),\\n            ),\\n            \\n            // 성공\\n            AsyncSuccess(:final data) => RefreshIndicator(\\n              onRefresh: postsState.refresh,\\n              child: ListView.builder(\\n                itemCount: data.length,\\n                itemBuilder: (context, index) {\\n                  final post = data[index];\\n                  return Card(\\n                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),\\n                    child: ListTile(\\n                      leading: CircleAvatar(child: Text('\${post.id}')),\\n                      title: Text(post.title),\\n                      subtitle: Text(\\n                        post.body,\\n                        maxLines: 2,\\n                        overflow: TextOverflow.ellipsis,\\n                      ),\\n                    ),\\n                  );\\n                },\\n              ),\\n            ),\\n            \\n            // 에러\\n            AsyncError(:final message, :final retry) => Center(\\n              child: Padding(\\n                padding: const EdgeInsets.all(32),\\n                child: Column(\\n                  mainAxisAlignment: MainAxisAlignment.center,\\n                  children: [\\n                    const Icon(Icons.error_outline, size: 64, color: Colors.red),\\n                    const SizedBox(height: 16),\\n                    Text(\\n                      '오류가 발생했습니다',\\n                      style: Theme.of(context).textTheme.headlineSmall,\\n                    ),\\n                    const SizedBox(height: 8),\\n                    Text(\\n                      message,\\n                      textAlign: TextAlign.center,\\n                      style: TextStyle(color: Colors.grey[600]),\\n                    ),\\n                    const SizedBox(height: 24),\\n                    if (retry != null)\\n                      ElevatedButton.icon(\\n                        onPressed: retry,\\n                        icon: const Icon(Icons.refresh),\\n                        label: const Text('다시 시도'),\\n                      ),\\n                  ],\\n                ),\\n              ),\\n            ),\\n          };\\n        },\\n      ),\\n    );\\n  }\\n}"
      },
      "explanation": "sealed class를 사용하면 컴파일러가 모든 상태(loading, success, error)를 처리했는지 검사합니다. 하나라도 빠뜨리면 경고가 뜨죠. 이 패턴 덕분에 '로딩 중인데 에러 메시지가 보인다'거나 '성공했는데 스피너가 계속 돈다'는 버그를 방지할 수 있습니다. retry 콜백을 전달해서 사용자가 직접 재시도할 수 있게 하는 것도 중요한 UX입니다.",
      "beginnerTip": "처음에는 bool isLoading, String? error 같은 변수를 여러 개 만들고 싶을 수 있어요. 하지만 그러면 'isLoading이 true인데 error도 있는' 불가능한 상태가 생길 수 있습니다. sealed class로 상태를 명확히 구분하세요."
    },
    {
      "stepNumber": 5,
      "title": "실무 폴더 구조 및 의존성 주입",
      "description": "대규모 앱에서 사용하는 폴더 구조와 Provider를 활용한 의존성 주입 패턴을 학습합니다. 테스트하기 쉽고 유지보수가 편한 코드를 작성합니다.",
      "whatYouWillLearn": [
        "Feature-First 폴더 구조",
        "Repository 패턴과 Provider 연동",
        "테스트를 위한 Mock 주입"
      ],
      "substeps": [
        "기능별 폴더 분리 (features/)",
        "Repository 인터페이스와 구현체 분리",
        "테스트 시 Mock Repository 주입"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/features/posts/posts_feature.dart",
        "content": "// ========================================\\n// 📁 실무 폴더 구조 예시\\n// ========================================\\n//\\n// lib/\\n// ├── core/                    # 공통 유틸리티\\n// │   ├── network/             # API 클라이언트\\n// │   └── error/               # 에러 핸들링\\n// │\\n// ├── features/                # 기능별 모듈\\n// │   ├── auth/                # 인증 기능\\n// │   │   ├── data/            #   - 데이터 레이어\\n// │   │   │   ├── repositories/\\n// │   │   │   └── models/\\n// │   │   ├── domain/          #   - 비즈니스 로직\\n// │   │   └── presentation/    #   - UI\\n// │   │       ├── screens/\\n// │   │       ├── widgets/\\n// │   │       └── state/       #   - Provider 상태\\n// │   │\\n// │   └── posts/               # 게시글 기능\\n// │       ├── data/\\n// │       ├── domain/\\n// │       └── presentation/\\n// │\\n// └── main.dart\\n//\\n// ========================================\\n\\nimport 'package:flutter/material.dart';\\nimport 'package:provider/provider.dart';\\n\\n// ========== 1. Repository 인터페이스 (추상화) ==========\\n\\n/// 게시글 데이터 접근을 위한 인터페이스\\n/// 실제 구현체와 Mock을 교체할 수 있음\\nabstract class PostRepository {\\n  Future<List<Post>> getPosts();\\n  Future<Post> getPostById(int id);\\n  Future<void> createPost(Post post);\\n}\\n\\n// ========== 2. 실제 구현체 (프로덕션용) ==========\\n\\nclass PostRepositoryImpl implements PostRepository {\\n  final ApiClient _apiClient;  // HTTP 클라이언트\\n  \\n  PostRepositoryImpl(this._apiClient);\\n  \\n  @override\\n  Future<List<Post>> getPosts() async {\\n    final response = await _apiClient.get('/posts');\\n    return (response.data as List)\\n        .map((json) => Post.fromJson(json))\\n        .toList();\\n  }\\n  \\n  @override\\n  Future<Post> getPostById(int id) async {\\n    final response = await _apiClient.get('/posts/\$id');\\n    return Post.fromJson(response.data);\\n  }\\n  \\n  @override\\n  Future<void> createPost(Post post) async {\\n    await _apiClient.post('/posts', data: post.toJson());\\n  }\\n}\\n\\n// ========== 3. Mock 구현체 (테스트용) ==========\\n\\nclass MockPostRepository implements PostRepository {\\n  final List<Post> _fakePosts = [\\n    Post(id: 1, title: '테스트 게시글 1', body: '내용 1'),\\n    Post(id: 2, title: '테스트 게시글 2', body: '내용 2'),\\n  ];\\n  \\n  @override\\n  Future<List<Post>> getPosts() async {\\n    await Future.delayed(const Duration(milliseconds: 100));\\n    return _fakePosts;\\n  }\\n  \\n  @override\\n  Future<Post> getPostById(int id) async {\\n    return _fakePosts.firstWhere((p) => p.id == id);\\n  }\\n  \\n  @override\\n  Future<void> createPost(Post post) async {\\n    _fakePosts.add(post);\\n  }\\n}\\n\\n// ========== 4. State 클래스 (Repository에 의존) ==========\\n\\nclass PostsState extends ChangeNotifier {\\n  final PostRepository _repository;  // 인터페이스에 의존 (구현체 아님!)\\n  \\n  AsyncState<List<Post>> _state = const AsyncLoading();\\n  AsyncState<List<Post>> get state => _state;\\n  \\n  // 생성자에서 Repository 주입받음\\n  PostsState(this._repository) {\\n    loadPosts();\\n  }\\n  \\n  Future<void> loadPosts() async {\\n    _state = const AsyncLoading();\\n    notifyListeners();\\n    \\n    try {\\n      final posts = await _repository.getPosts();\\n      _state = AsyncSuccess(posts);\\n    } catch (e) {\\n      _state = AsyncError(e.toString(), retry: loadPosts);\\n    }\\n    notifyListeners();\\n  }\\n}\\n\\n// ========== 5. Provider 설정 ==========\\n\\n/// 프로덕션 앱용 Provider 설정\\nclass AppProviders extends StatelessWidget {\\n  final Widget child;\\n  \\n  const AppProviders({super.key, required this.child});\\n  \\n  @override\\n  Widget build(BuildContext context) {\\n    return MultiProvider(\\n      providers: [\\n        // API 클라이언트\\n        Provider<ApiClient>(\\n          create: (_) => ApiClient(baseUrl: 'https://api.example.com'),\\n        ),\\n        \\n        // Repository (실제 구현체)\\n        ProxyProvider<ApiClient, PostRepository>(\\n          update: (_, apiClient, __) => PostRepositoryImpl(apiClient),\\n        ),\\n        \\n        // State (Repository 주입)\\n        ChangeNotifierProxyProvider<PostRepository, PostsState>(\\n          create: (context) => PostsState(context.read<PostRepository>()),\\n          update: (_, repository, previous) => previous ?? PostsState(repository),\\n        ),\\n      ],\\n      child: child,\\n    );\\n  }\\n}\\n\\n/// 테스트용 Provider 설정\\nclass TestProviders extends StatelessWidget {\\n  final Widget child;\\n  \\n  const TestProviders({super.key, required this.child});\\n  \\n  @override\\n  Widget build(BuildContext context) {\\n    return MultiProvider(\\n      providers: [\\n        // Mock Repository 사용\\n        Provider<PostRepository>(\\n          create: (_) => MockPostRepository(),\\n        ),\\n        ChangeNotifierProxyProvider<PostRepository, PostsState>(\\n          create: (context) => PostsState(context.read<PostRepository>()),\\n          update: (_, repository, previous) => previous ?? PostsState(repository),\\n        ),\\n      ],\\n      child: child,\\n    );\\n  }\\n}\\n\\n// ========== 6. 테스트 예시 ==========\\n\\n// test/features/posts/posts_state_test.dart\\n/*\\nvoid main() {\\n  test('게시글 로드 성공 시 AsyncSuccess 상태가 됨', () async {\\n    // Given: Mock Repository 사용\\n    final mockRepo = MockPostRepository();\\n    final state = PostsState(mockRepo);\\n    \\n    // When: 로드 완료 대기\\n    await Future.delayed(const Duration(milliseconds: 200));\\n    \\n    // Then: 성공 상태 확인\\n    expect(state.state, isA<AsyncSuccess<List<Post>>>());\\n  });\\n}\\n*/"
      },
      "explanation": "의존성 주입(DI)의 핵심은 '구현체가 아닌 인터페이스에 의존하는 것'입니다. PostsState는 PostRepository 인터페이스만 알고, 실제로 PostRepositoryImpl인지 MockPostRepository인지 모릅니다. 덕분에 프로덕션에서는 실제 API를 호출하고, 테스트에서는 가짜 데이터를 반환하도록 쉽게 교체할 수 있습니다. Provider의 ProxyProvider가 이 교체 작업을 깔끔하게 처리해줍니다.",
      "beginnerTip": "이 구조가 복잡해 보일 수 있어요. 하지만 앱이 커지면 이 구조 덕분에 '게시글 기능은 features/posts 폴더만 보면 된다'는 명확한 규칙이 생깁니다. 팀 협업과 유지보수가 훨씬 쉬워져요."
    },
    {
      "stepNumber": 6,
      "title": "Provider 디버깅과 DevTools 활용",
      "description": "개발 중 상태 변화를 추적하고, 문제가 발생했을 때 빠르게 원인을 찾는 방법을 배웁니다.",
      "whatYouWillLearn": [
        "Provider DevTools 사용법",
        "상태 변화 로깅",
        "흔한 버그 패턴과 해결법"
      ],
      "substeps": [
        "Flutter DevTools Provider 탭 활용",
        "ProviderObserver로 상태 변화 로깅",
        "빌드 횟수 확인으로 성능 문제 진단"
      ],
      "code": {
        "language": "dart",
        "filename": "lib/core/debug/provider_observer.dart",
        "content": "import 'package:flutter/foundation.dart';\\nimport 'package:provider/provider.dart';\\n\\n// ========== Provider 상태 변화 로깅 ==========\\n\\n/// 개발 환경에서 모든 Provider 상태 변화를 로깅\\nclass DebugProviderObserver extends ProviderObserver {\\n  @override\\n  void didUpdateProvider(\\n    ProviderBase provider,\\n    Object? previousValue,\\n    Object? newValue,\\n    ProviderContainer container,\\n  ) {\\n    if (kDebugMode) {\\n      print('''\\n╔════════════════════════════════════════\\n║ 🔄 Provider 업데이트\\n║ Provider: \${provider.runtimeType}\\n║ 이전 값: \$previousValue\\n║ 새 값: \$newValue\\n╚════════════════════════════════════════\\n''');\\n    }\\n  }\\n}\\n\\n// ========== 빌드 횟수 추적 위젯 ==========\\n\\n/// 위젯이 몇 번 빌드되는지 확인\\n/// 불필요한 리빌드를 찾는 데 유용\\nclass BuildTracker extends StatelessWidget {\\n  final String name;\\n  final Widget child;\\n  \\n  const BuildTracker({\\n    super.key,\\n    required this.name,\\n    required this.child,\\n  });\\n  \\n  static final Map<String, int> _buildCounts = {};\\n  \\n  @override\\n  Widget build(BuildContext context) {\\n    if (kDebugMode) {\\n      _buildCounts[name] = (_buildCounts[name] ?? 0) + 1;\\n      print('🏗️ [\$name] 빌드 횟수: \${_buildCounts[name]}');\\n    }\\n    return child;\\n  }\\n  \\n  /// 빌드 카운트 리셋 (테스트용)\\n  static void resetCounts() {\\n    _buildCounts.clear();\\n  }\\n  \\n  /// 현재 빌드 카운트 확인\\n  static int getCount(String name) => _buildCounts[name] ?? 0;\\n}\\n\\n// ========== 사용 예시 ==========\\n\\n/*\\nclass MyScreen extends StatelessWidget {\\n  @override\\n  Widget build(BuildContext context) {\\n    return BuildTracker(\\n      name: 'MyScreen',\\n      child: Scaffold(\\n        body: Column(\\n          children: [\\n            // 이 위젯이 너무 자주 빌드되면 Consumer로 분리 필요\\n            BuildTracker(\\n              name: 'HeaderSection',\\n              child: Consumer<MyState>(\\n                builder: (context, state, child) {\\n                  return Text(state.title);\\n                },\\n              ),\\n            ),\\n          ],\\n        ),\\n      ),\\n    );\\n  }\\n}\\n*/\\n\\n// ========== 흔한 버그 패턴 ==========\\n\\n/*\\n\\n❌ 버그 1: build() 안에서 상태 변경\\n\\nclass BadWidget extends StatelessWidget {\\n  @override\\n  Widget build(BuildContext context) {\\n    // 🚨 절대 하면 안 됨! 무한 루프 발생\\n    context.read<CounterState>().increment();\\n    return Text('count');\\n  }\\n}\\n\\n✅ 해결: initState나 버튼 콜백에서 호출\\n\\n---\\n\\n❌ 버그 2: dispose된 후 notifyListeners 호출\\n\\nclass BadState extends ChangeNotifier {\\n  Future<void> fetchData() async {\\n    await Future.delayed(Duration(seconds: 5));\\n    // 🚨 위젯이 이미 dispose됐으면 에러!\\n    notifyListeners();\\n  }\\n}\\n\\n✅ 해결: dispose 여부 체크\\n\\nclass GoodState extends ChangeNotifier {\\n  bool _disposed = false;\\n  \\n  @override\\n  void dispose() {\\n    _disposed = true;\\n    super.dispose();\\n  }\\n  \\n  void _safeNotify() {\\n    if (!_disposed) notifyListeners();\\n  }\\n}\\n\\n---\\n\\n❌ 버그 3: Provider 범위 밖에서 접근\\n\\nclass BadWidget extends StatelessWidget {\\n  @override\\n  Widget build(BuildContext context) {\\n    // 🚨 이 위젯이 Provider 밖에 있으면 에러!\\n    final state = context.read<MyState>();\\n    return Text(state.value);\\n  }\\n}\\n\\n✅ 해결: Provider가 충분히 상위에 있는지 확인\\n   또는 Provider.of(context, listen: false) 대신 try-catch\\n\\n*/\\n\\n// ========== DevTools 활용 팁 ==========\\n\\n/*\\n\\n1. Flutter DevTools 실행:\\n   $ flutter pub global activate devtools\\n   $ flutter pub global run devtools\\n\\n2. Provider 탭에서 확인 가능한 것들:\\n   - 현재 등록된 모든 Provider\\n   - 각 Provider의 현재 상태 값\\n   - 어떤 위젯이 어떤 Provider를 구독하는지\\n\\n3. Performance 탭에서 확인:\\n   - rebuild가 너무 자주 일어나는 위젯\\n   - 프레임 드롭 원인\\n\\n4. Widget Inspector에서 확인:\\n   - 위젯 트리에서 Provider 위치\\n   - context.watch vs read 사용 여부\\n\\n*/"
      },
      "explanation": "개발 중에는 상태 변화를 눈으로 확인하는 것이 중요합니다. BuildTracker로 어떤 위젯이 몇 번 빌드되는지 확인하면, 불필요한 리빌드를 쉽게 발견할 수 있습니다. 특히 리스트 아이템처럼 반복되는 위젯이 전체 리빌드되면 성능 문제가 생기죠. 또한 주석에 정리된 흔한 버그 패턴들을 미리 알아두면 디버깅 시간을 크게 줄일 수 있습니다."
    }
  ],
  "commonErrors": [
    {
      "error": "ProviderNotFoundException: Could not find the correct Provider<T> above this Widget",
      "cause": "Provider가 위젯 트리의 상위에 등록되지 않았거나, 잘못된 타입으로 접근하는 경우",
      "solution": "1. main.dart에서 MaterialApp을 Provider로 감쌌는지 확인\\n2. 접근하려는 타입이 정확한지 확인 (Provider<UserState>와 Provider<AuthState>는 다름)\\n3. 테스트 환경이라면 테스트용 Provider를 제공했는지 확인"
    },
    {
      "error": "setState() or markNeedsBuild() called during build",
      "cause": "build() 메서드 안에서 상태를 변경하려고 할 때 발생",
      "solution": "build() 안에서 context.read<State>().someMethod() 호출 금지. 대신 initState()나 버튼의 onPressed에서 호출하세요."
    },
    {
      "error": "A <ClassName> was used after being disposed",
      "cause": "위젯이 화면에서 사라진 후(dispose된 후) 비동기 작업이 완료되어 notifyListeners()를 호출할 때",
      "solution": "ChangeNotifier에 _disposed 플래그를 추가하고, notifyListeners() 전에 체크하세요. 또는 autoDispose가 지원되는 riverpod 사용을 고려하세요."
    },
    {
      "error": "Tried to listen to a value exposed by provider, but it threw an exception",
      "cause": "Provider의 create 함수에서 에러가 발생하거나, 의존하는 다른 Provider가 에러 상태인 경우",
      "solution": "create 함수 내부를 try-catch로 감싸거나, ErrorWidget.builder를 설정하여 에러 UI를 표시하세요."
    }
  ],
  "tips": [
    "context.select<State, T>()를 사용하면 상태의 특정 필드만 구독할 수 있습니다. 예: context.select<UserState, String>((s) => s.name)은 name이 변할 때만 리빌드됩니다.",
    "여러 Provider에서 값을 조합해야 할 때는 Consumer2, Consumer3... 보다 Selector로 필요한 값만 추출하는 것이 성능에 좋습니다.",
    "ChangeNotifier 대신 ValueNotifier<T>를 사용하면 단일 값 상태를 더 간단하게 관리할 수 있습니다. 예: final counter = ValueNotifier(0);"
  ],
  "bestPractices": [
    {
      "title": "상태는 불변(immutable)으로 관리",
      "description": "리스트를 수정할 때 _items.add() 대신 _items = [..._items, newItem]으로 새 리스트를 만드세요. 디버깅이 쉬워지고 예측 가능한 상태 변화를 보장합니다."
    },
    {
      "title": "하나의 ChangeNotifier는 하나의 책임만",
      "description": "AuthState가 로그인도 하고 사용자 프로필도 관리하면 너무 비대해집니다. AuthState와 ProfileState를 분리하세요."
    },
    {
      "title": "비즈니스 로직은 State에, UI 로직은 Widget에",
      "description": "날짜 포맷팅, 숫자 천 단위 콤마 같은 표시용 로직은 Widget에서 처리하세요. State는 순수한 데이터만 가지고 있어야 테스트하기 쉽습니다."
    }
  ],
  "nextSteps": [
    {
      "title": "Riverpod으로 마이그레이션",
      "description": "Provider의 개선 버전인 Riverpod은 컴파일 타임 안전성, 더 나은 테스트 지원, autoDispose 등을 제공합니다. Provider에 익숙해졌다면 다음 단계로 고려하세요."
    },
    {
      "title": "상태 관리 + 라우팅 통합",
      "description": "go_router와 Provider를 함께 사용하면 로그인 상태에 따라 자동으로 페이지를 리다이렉트하는 등 강력한 네비게이션을 구현할 수 있습니다."
    }
  ],
  "references": [
    { "title": "Provider 공식 문서", "url": "https://pub.dev/packages/provider" },
    { "title": "Flutter 상태 관리 공식 가이드", "url": "https://docs.flutter.dev/data-and-backend/state-mgmt" },
    { "title": "Provider 예제 앱", "url": "https://github.com/rrousselGit/provider/tree/master/examples" }
  ]
}
\`\`\`

위 예시의 핵심 특징을 반드시 따르세요:
1. **coreConcepts**: 초심자를 위한 핵심 개념 설명 (비유 포함)
2. **whatYouWillLearn**: 각 단계에서 배울 내용 명시
3. **beginnerTip**: 초심자가 헷갈리기 쉬운 부분 설명
4. **commonMistake**: 각 단계에서 흔히 하는 실수
5. **코드 주석**: 한국어로 상세한 주석 필수
6. **6단계 이상**: 기초부터 고급까지 점진적으로
7. **bestPractices**: 실무 베스트 프랙티스 섹션`;

  return `당신은 15년 차 시니어 Flutter/Dart 아키텍트이자, 100명 이상의 주니어 개발자를 육성한 기술 교육 전문가입니다.

${fewShotExample}

---

## 이제 아래 패키지에 대해 위 예시와 동일한 수준과 분량의 가이드를 작성하세요.

### 대상 패키지 정보
- **이름**: ${pkg.name}
- **버전**: ${pkg.version || 'latest'}
- **설명**: ${pkg.description || '정보 없음'}
- **지원 플랫폼**: ${(pkg.platforms || []).join(', ') || 'all'}
${exampleSection}

## ⚠️ 필수 작성 규칙

### 1. 초심자 친화적 설명
- **coreConcepts** 필드에 패키지의 핵심 개념 3-5개를 일상적인 비유와 함께 설명
- 각 단계에 **whatYouWillLearn**, **beginnerTip**, **commonMistake** 포함
- 전문 용어는 처음 등장할 때 반드시 쉬운 말로 풀어서 설명

### 2. 단계 구성 (최소 6단계)
- **Step 1**: 설치 + 기본 개념 + 첫 번째 동작하는 예제
- **Step 2-3**: 핵심 기능을 실제 앱에 적용하는 방법
- **Step 4-5**: 고급 패턴, 성능 최적화, 에러 핸들링
- **Step 6**: 테스트 작성 또는 디버깅 방법

### 3. 코드 품질
- 모든 code.content는 **바로 복사해서 동작하는 완전한 코드**
- **한국어 주석으로 각 줄이 무엇을 하는지 상세히 설명**
- 최소 40줄 이상의 실질적인 코드
- import문, 클래스 전체, 필요한 모든 메서드 포함

### 4. 에러와 베스트 프랙티스
- **commonErrors**: 에러 메시지, 원인(cause), 해결책(solution) 모두 포함
- **bestPractices**: 실무에서 꼭 지켜야 할 패턴 3개 이상

### 5. 출력 형식
- 반드시 순수 JSON만 출력 (마크다운 코드블록 없이)
- 위 예시와 동일한 JSON 구조 유지
- 분량: 최소 위 예시만큼 상세하게

이제 "${pkg.name}" 패키지에 대한 **초심자도 이해할 수 있는 고급 구현 가이드**를 JSON으로 출력하세요:`;
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
