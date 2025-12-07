// Netlify Function for guide API (Alternative - 데이터 직접 임베드)
// 만약 require()가 안 되면 이 파일을 guide.js로 이름 변경하세요

// JSON 데이터를 직접 객체로 임베드
const GUIDES = {
  firebase_auth: {
    "packageId": "firebase_auth",
    "packageName": "firebase_auth",
    "title": "Firebase Auth 구현 가이드",
    "description": "Firebase Authentication을 사용하여 Flutter 앱에 이메일/비밀번호 로그인을 구현하는 단계별 가이드입니다.",
    "difficulty": "중급",
    "estimatedTime": "30-45분",
    "prerequisites": [
      "Firebase 프로젝트 생성 (console.firebase.google.com)",
      "Flutter 프로젝트 준비 완료",
      "FlutterFire CLI 설치 (npm install -g firebase-tools)"
    ],
    "steps": [
      {
        "stepNumber": 1,
        "title": "Firebase 프로젝트 설정",
        "description": "Firebase Console에서 프로젝트를 생성하고 인증 방법을 활성화합니다.",
        "substeps": [
          "https://console.firebase.google.com 접속",
          "새 프로젝트 생성 또는 기존 프로젝트 선택",
          "좌측 메뉴에서 'Authentication' 클릭",
          "'Sign-in method' 탭에서 'Email/Password' 활성화"
        ],
        "note": "Google 로그인 등 추가 방법도 나중에 활성화할 수 있습니다."
      },
      {
        "stepNumber": 2,
        "title": "필수 패키지 설치",
        "description": "Firebase Core와 Auth 패키지를 pubspec.yaml에 추가합니다.",
        "code": {
          "language": "yaml",
          "filename": "pubspec.yaml",
          "content": "dependencies:\n  flutter:\n    sdk: flutter\n  firebase_core: ^3.0.0\n  firebase_auth: ^5.0.0"
        },
        "command": "flutter pub get"
      }
      // ... 나머지 steps는 backend/data/examples/firebase_auth.json에서 복사
    ],
    "commonErrors": [
      {
        "error": "[core/no-app] No Firebase App '[DEFAULT]' has been created",
        "solution": "main() 함수에서 Firebase.initializeApp()을 호출했는지 확인하세요. WidgetsFlutterBinding.ensureInitialized()도 필요합니다.",
        "link": null
      }
    ],
    "tips": [
      "개발 중에는 Firebase Local Emulator Suite를 사용하면 무료로 테스트할 수 있습니다.",
      "사용자 정보는 Firebase Console의 Authentication 탭에서 실시간으로 확인 가능합니다."
    ],
    "references": [
      {
        "title": "Firebase Auth 공식 문서",
        "url": "https://firebase.google.com/docs/auth/flutter/start"
      }
    ]
  },

  google_sign_in: {
    "packageId": "google_sign_in",
    "packageName": "google_sign_in",
    "title": "Google Sign In 구현 가이드",
    "description": "Google Sign In을 사용하여 Flutter 앱에 Google 계정 로그인을 구현하는 단계별 가이드입니다.",
    "difficulty": "중급",
    "estimatedTime": "40-60분",
    "prerequisites": [
      "Google Cloud Console 프로젝트 생성",
      "Flutter 프로젝트 준비 완료",
      "iOS는 Xcode 설정 필요, Android는 SHA-1 인증서 필요"
    ],
    "steps": [
      {
        "stepNumber": 1,
        "title": "Google Cloud Console 설정",
        "description": "OAuth 2.0 클라이언트 ID를 생성합니다.",
        "substeps": [
          "https://console.cloud.google.com 접속",
          "프로젝트 생성 또는 선택",
          "'APIs & Services' > 'Credentials' 이동",
          "'OAuth 2.0 Client IDs' 생성 (iOS, Android, Web용)"
        ],
        "note": "각 플랫폼별로 별도의 클라이언트 ID가 필요합니다."
      },
      {
        "stepNumber": 2,
        "title": "패키지 설치",
        "description": "google_sign_in 패키지를 추가합니다.",
        "code": {
          "language": "yaml",
          "filename": "pubspec.yaml",
          "content": "dependencies:\n  flutter:\n    sdk: flutter\n  google_sign_in: ^6.2.1\n  http: ^1.1.0  # API 호출용 (선택사항)"
        },
        "command": "flutter pub get"
      },
      {
        "stepNumber": 3,
        "title": "초기화 및 설정",
        "description": "GoogleSignIn 인스턴스를 초기화합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/main.dart",
          "content": "import 'package:google_sign_in/google_sign_in.dart';\n\n// Client ID 설정 (선택사항)\nString? clientId;\nString? serverClientId;\n\n// 권한 스코프 설정\nconst List<String> scopes = <String>[\n  'https://www.googleapis.com/auth/contacts.readonly',\n];\n\n// GoogleSignIn 초기화\nfinal GoogleSignIn signIn = GoogleSignIn.instance;\nawait signIn.initialize(\n  clientId: clientId,\n  serverClientId: serverClientId\n);"
        }
      },
      {
        "stepNumber": 4,
        "title": "인증 이벤트 리스너 설정",
        "description": "로그인/로그아웃 이벤트를 처리합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/auth_handler.dart",
          "content": "Future<void> _handleAuthenticationEvent(\n  GoogleSignInAuthenticationEvent event,\n) async {\n  final GoogleSignInAccount? user = switch (event) {\n    GoogleSignInAuthenticationEventSignIn() => event.user,\n    GoogleSignInAuthenticationEventSignOut() => null,\n  };\n\n  // 기존 권한 확인\n  final GoogleSignInClientAuthorization? authorization = \n    await user?.authorizationClient.authorizationForScopes(scopes);\n\n  setState(() {\n    _currentUser = user;\n    _isAuthorized = authorization != null;\n  });\n}"
        }
      },
      {
        "stepNumber": 5,
        "title": "로그인 구현",
        "description": "명시적 로그인 버튼을 구현합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/sign_in_button.dart",
          "content": "if (GoogleSignIn.instance.supportsAuthenticate())\n  ElevatedButton(\n    onPressed: () async {\n      try {\n        await GoogleSignIn.instance.authenticate();\n      } catch (e) {\n        // 에러 처리\n        print('Sign in error: $e');\n      }\n    },\n    child: const Text('SIGN IN'),\n  )"
        }
      },
      {
        "stepNumber": 6,
        "title": "권한 요청",
        "description": "추가 스코프 권한을 요청합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/authorize_scopes.dart",
          "content": "Future<void> _handleAuthorizeScopes(GoogleSignInAccount user) async {\n  try {\n    final GoogleSignInClientAuthorization authorization = \n      await user.authorizationClient.authorizeScopes(scopes);\n    \n    setState(() {\n      _isAuthorized = true;\n    });\n  } on GoogleSignInException catch (e) {\n    print('Authorization error: $e');\n  }\n}"
        }
      },
      {
        "stepNumber": 7,
        "title": "Google API 호출",
        "description": "인증 헤더를 사용하여 Google API를 호출합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/api_call.dart",
          "content": "Future<void> _handleGetContact(GoogleSignInAccount user) async {\n  final Map<String, String>? headers = \n    await user.authorizationClient.authorizationHeaders(scopes);\n  \n  if (headers == null) {\n    print('Failed to construct authorization headers.');\n    return;\n  }\n  \n  final http.Response response = await http.get(\n    Uri.parse(\n      'https://people.googleapis.com/v1/people/me/connections'\n      '?requestMask.includeField=person.names',\n    ),\n    headers: headers,\n  );\n  \n  if (response.statusCode == 200) {\n    final Map<String, dynamic> data = json.decode(response.body);\n    // 데이터 처리\n  }\n}"
        }
      },
      {
        "stepNumber": 8,
        "title": "서버 인증 코드 요청",
        "description": "백엔드에서 사용할 서버 인증 코드를 요청합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/server_auth.dart",
          "content": "Future<void> _handleGetAuthCode(GoogleSignInAccount user) async {\n  try {\n    final GoogleSignInServerAuthorization? serverAuth = \n      await user.authorizationClient.authorizeServer(scopes);\n    \n    if (serverAuth != null) {\n      print('Server auth code: ${serverAuth.serverAuthCode}');\n      // 서버로 전송\n    }\n  } on GoogleSignInException catch (e) {\n    print('Server auth error: $e');\n  }\n}"
        }
      },
      {
        "stepNumber": 9,
        "title": "로그아웃 구현",
        "description": "사용자 로그아웃 및 연결 해제를 구현합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/sign_out.dart",
          "content": "Future<void> _handleSignOut() async {\n  // disconnect()는 연결을 완전히 해제하고 상태를 리셋합니다\n  await GoogleSignIn.instance.disconnect();\n  \n  // 또는 signOut()만 사용 (연결은 유지)\n  // await GoogleSignIn.instance.signOut();\n}"
        }
      },
      {
        "stepNumber": 10,
        "title": "UI 구현",
        "description": "사용자 정보를 표시하는 UI를 만듭니다.",
        "code": {
          "language": "dart",
          "filename": "lib/user_profile.dart",
          "content": "if (user != null) {\n  ListTile(\n    leading: GoogleUserCircleAvatar(identity: user),\n    title: Text(user.displayName ?? ''),\n    subtitle: Text(user.email),\n  )\n} else {\n  const Text('You are not currently signed in.')\n}"
        }
      }
    ],
    "commonErrors": [
      {
        "error": "PlatformException(sign_in_failed)",
        "solution": "1. iOS: Xcode에서 URL Schemes 설정 확인\n2. Android: SHA-1 인증서가 Google Console에 등록되어 있는지 확인\n3. Client ID가 올바른지 확인",
        "link": null
      },
      {
        "error": "API 401/403 오류",
        "solution": "authorizeScopes()를 호출하여 필요한 권한을 다시 요청하세요. Google Cloud Console에서 API가 활성화되어 있는지도 확인하세요.",
        "link": null
      },
      {
        "error": "GoogleSignInException canceled",
        "solution": "사용자가 로그인을 취소했습니다. 이는 정상적인 동작이며 별도 처리가 필요 없습니다.",
        "link": null
      }
    ],
    "tips": [
      "Web에서는 renderButton()을 사용하여 Google의 공식 로그인 버튼을 렌더링할 수 있습니다.",
      "serverClientId는 백엔드에서 토큰 검증이 필요할 때만 설정하면 됩니다.",
      "scopes는 필요한 최소한의 권한만 요청하는 것이 좋습니다.",
      "authenticationRequiresUserInteraction()으로 사용자 인터랙션이 필요한지 확인할 수 있습니다.",
      "attemptLightweightAuthentication()을 사용하면 앱 시작 시 자동 로그인을 시도합니다."
    ],
    "references": [
      {
        "title": "Google Sign In 공식 문서",
        "url": "https://pub.dev/packages/google_sign_in"
      },
      {
        "title": "Google Cloud Console",
        "url": "https://console.cloud.google.com"
      },
      {
        "title": "OAuth 2.0 Scopes",
        "url": "https://developers.google.com/identity/protocols/oauth2/scopes"
      }
    ],
    "exampleCode": {
      "language": "dart",
      "fullExample": "// Copyright 2013 The Flutter Authors. All rights reserved.\n// Use of this source code is governed by a BSD-style license that can be\n// found in the LICENSE file.\n\nimport 'dart:async';\nimport 'dart:convert' show json;\n\nimport 'package:flutter/foundation.dart';\nimport 'package:flutter/material.dart';\nimport 'package:google_sign_in/google_sign_in.dart';\nimport 'package:http/http.dart' as http;\n\nimport 'src/web_wrapper.dart' as web;\n\n/// Client ID (실제 값으로 교체 필요)\nString? clientId;\nString? serverClientId;\n\n/// 필요한 권한 스코프\nconst List<String> scopes = <String>[\n  'https://www.googleapis.com/auth/contacts.readonly',\n];\n\nvoid main() {\n  runApp(const MaterialApp(title: 'Google Sign In', home: SignInDemo()));\n}\n\nclass SignInDemo extends StatefulWidget {\n  const SignInDemo({super.key});\n\n  @override\n  State createState() => _SignInDemoState();\n}\n\nclass _SignInDemoState extends State<SignInDemo> {\n  GoogleSignInAccount? _currentUser;\n  bool _isAuthorized = false;\n  String _contactText = '';\n  String _errorMessage = '';\n  String _serverAuthCode = '';\n\n  @override\n  void initState() {\n    super.initState();\n\n    final GoogleSignIn signIn = GoogleSignIn.instance;\n    unawaited(\n      signIn.initialize(clientId: clientId, serverClientId: serverClientId).then((_) {\n        signIn.authenticationEvents\n            .listen(_handleAuthenticationEvent)\n            .onError(_handleAuthenticationError);\n\n        signIn.attemptLightweightAuthentication();\n      }),\n    );\n  }\n\n  Future<void> _handleAuthenticationEvent(\n    GoogleSignInAuthenticationEvent event,\n  ) async {\n    final GoogleSignInAccount? user = switch (event) {\n      GoogleSignInAuthenticationEventSignIn() => event.user,\n      GoogleSignInAuthenticationEventSignOut() => null,\n    };\n\n    final GoogleSignInClientAuthorization? authorization = \n      await user?.authorizationClient.authorizationForScopes(scopes);\n\n    setState(() {\n      _currentUser = user;\n      _isAuthorized = authorization != null;\n      _errorMessage = '';\n    });\n\n    if (user != null && authorization != null) {\n      unawaited(_handleGetContact(user));\n    }\n  }\n\n  Future<void> _handleAuthenticationError(Object e) async {\n    setState(() {\n      _currentUser = null;\n      _isAuthorized = false;\n      _errorMessage = e is GoogleSignInException\n          ? _errorMessageFromSignInException(e)\n          : 'Unknown error: $e';\n    });\n  }\n\n  Future<void> _handleGetContact(GoogleSignInAccount user) async {\n    setState(() {\n      _contactText = 'Loading contact info...';\n    });\n    \n    final Map<String, String>? headers = \n      await user.authorizationClient.authorizationHeaders(scopes);\n    \n    if (headers == null) {\n      setState(() {\n        _contactText = '';\n        _errorMessage = 'Failed to construct authorization headers.';\n      });\n      return;\n    }\n    \n    final http.Response response = await http.get(\n      Uri.parse(\n        'https://people.googleapis.com/v1/people/me/connections'\n        '?requestMask.includeField=person.names',\n      ),\n      headers: headers,\n    );\n    \n    if (response.statusCode != 200) {\n      if (response.statusCode == 401 || response.statusCode == 403) {\n        setState(() {\n          _isAuthorized = false;\n          _errorMessage = 'People API gave a ${response.statusCode} response. '\n              'Please re-authorize access.';\n        });\n      } else {\n        setState(() {\n          _contactText = 'People API gave a ${response.statusCode} response.';\n        });\n      }\n      return;\n    }\n    \n    final Map<String, dynamic> data = json.decode(response.body);\n    final String? namedContact = _pickFirstNamedContact(data);\n    \n    setState(() {\n      if (namedContact != null) {\n        _contactText = 'I see you know $namedContact!';\n      } else {\n        _contactText = 'No contacts to display.';\n      }\n    });\n  }\n\n  String? _pickFirstNamedContact(Map<String, dynamic> data) {\n    final List<dynamic>? connections = data['connections'] as List<dynamic>?;\n    final Map<String, dynamic>? contact = connections?.firstWhere(\n      (dynamic contact) => (contact as Map<Object?, dynamic>)['names'] != null,\n      orElse: () => null,\n    ) as Map<String, dynamic>?;\n    \n    if (contact != null) {\n      final List<dynamic> names = contact['names'] as List<dynamic>;\n      final Map<String, dynamic>? name = names.firstWhere(\n        (dynamic name) => (name as Map<Object?, dynamic>)['displayName'] != null,\n        orElse: () => null,\n      ) as Map<String, dynamic>?;\n      if (name != null) {\n        return name['displayName'] as String?;\n      }\n    }\n    return null;\n  }\n\n  Future<void> _handleAuthorizeScopes(GoogleSignInAccount user) async {\n    try {\n      final GoogleSignInClientAuthorization authorization = \n        await user.authorizationClient.authorizeScopes(scopes);\n\n      setState(() {\n        _isAuthorized = true;\n        _errorMessage = '';\n      });\n      unawaited(_handleGetContact(_currentUser!));\n    } on GoogleSignInException catch (e) {\n      _errorMessage = _errorMessageFromSignInException(e);\n    }\n  }\n\n  Future<void> _handleGetAuthCode(GoogleSignInAccount user) async {\n    try {\n      final GoogleSignInServerAuthorization? serverAuth = \n        await user.authorizationClient.authorizeServer(scopes);\n\n      setState(() {\n        _serverAuthCode = serverAuth == null ? '' : serverAuth.serverAuthCode;\n      });\n    } on GoogleSignInException catch (e) {\n      _errorMessage = _errorMessageFromSignInException(e);\n    }\n  }\n\n  Future<void> _handleSignOut() async {\n    await GoogleSignIn.instance.disconnect();\n  }\n\n  Widget _buildBody() {\n    final GoogleSignInAccount? user = _currentUser;\n    return Column(\n      mainAxisAlignment: MainAxisAlignment.spaceAround,\n      children: <Widget>[\n        if (user != null)\n          ..._buildAuthenticatedWidgets(user)\n        else\n          ..._buildUnauthenticatedWidgets(),\n        if (_errorMessage.isNotEmpty) Text(_errorMessage),\n      ],\n    );\n  }\n\n  List<Widget> _buildAuthenticatedWidgets(GoogleSignInAccount user) {\n    return <Widget>[\n      ListTile(\n        leading: GoogleUserCircleAvatar(identity: user),\n        title: Text(user.displayName ?? ''),\n        subtitle: Text(user.email),\n      ),\n      const Text('Signed in successfully.'),\n      if (_isAuthorized) ...<Widget>[\n        if (_contactText.isNotEmpty) Text(_contactText),\n        ElevatedButton(\n          child: const Text('REFRESH'),\n          onPressed: () => _handleGetContact(user),\n        ),\n        if (_serverAuthCode.isEmpty)\n          ElevatedButton(\n            child: const Text('REQUEST SERVER CODE'),\n            onPressed: () => _handleGetAuthCode(user),\n          )\n        else\n          Text('Server auth code:\\n$_serverAuthCode'),\n      ] else ...<Widget>[\n        const Text('Authorization needed to read your contacts.'),\n        ElevatedButton(\n          onPressed: () => _handleAuthorizeScopes(user),\n          child: const Text('REQUEST PERMISSIONS'),\n        ),\n      ],\n      ElevatedButton(\n        onPressed: _handleSignOut,\n        child: const Text('SIGN OUT')\n      ),\n    ];\n  }\n\n  List<Widget> _buildUnauthenticatedWidgets() {\n    return <Widget>[\n      const Text('You are not currently signed in.'),\n      if (GoogleSignIn.instance.supportsAuthenticate())\n        ElevatedButton(\n          onPressed: () async {\n            try {\n              await GoogleSignIn.instance.authenticate();\n            } catch (e) {\n              _errorMessage = e.toString();\n            }\n          },\n          child: const Text('SIGN IN'),\n        )\n      else ...<Widget>[\n        if (kIsWeb)\n          web.renderButton()\n        else\n          const Text('This platform does not have a known authentication method'),\n      ],\n    ];\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      appBar: AppBar(title: const Text('Google Sign In')),\n      body: ConstrainedBox(\n        constraints: const BoxConstraints.expand(),\n        child: _buildBody(),\n      ),\n    );\n  }\n\n  String _errorMessageFromSignInException(GoogleSignInException e) {\n    return switch (e.code) {\n      GoogleSignInExceptionCode.canceled => 'Sign in canceled',\n      _ => 'GoogleSignInException ${e.code}: ${e.description}',\n    };\n  }\n}"
    }
  },

  sign_in_with_apple: {
    "packageId": "sign_in_with_apple",
    "packageName": "sign_in_with_apple",
    "title": "Sign in with Apple 구현 가이드",
    "description": "Apple ID를 사용하여 Flutter 앱에 로그인을 구현하는 단계별 가이드입니다. iOS 앱스토어 출시 시 필수입니다.",
    "difficulty": "중급",
    "estimatedTime": "40-60분",
    "prerequisites": [
      "Apple Developer 계정 ($99/년)",
      "Xcode 설치 (iOS/macOS 개발)",
      "Flutter 프로젝트 준비 완료"
    ],
    "steps": [
      {
        "stepNumber": 1,
        "title": "Apple Developer 설정",
        "description": "Apple Developer 포털에서 Sign in with Apple을 활성화합니다.",
        "substeps": [
          "https://developer.apple.com 접속",
          "Certificates, Identifiers & Profiles 이동",
          "App ID 선택 후 'Sign in with Apple' Capability 활성화",
          "Service ID 생성 (Web 인증용)"
        ],
        "note": "iOS 앱에서 소셜 로그인을 제공하는 경우 Sign in with Apple은 필수입니다."
      },
      {
        "stepNumber": 2,
        "title": "패키지 설치",
        "description": "sign_in_with_apple 패키지를 추가합니다.",
        "code": {
          "language": "yaml",
          "filename": "pubspec.yaml",
          "content": "dependencies:\n  flutter:\n    sdk: flutter\n  sign_in_with_apple: ^6.1.2\n  http: ^1.1.0  # 백엔드 통신용 (선택사항)"
        },
        "command": "flutter pub get"
      },
      {
        "stepNumber": 3,
        "title": "iOS 설정 (Xcode)",
        "description": "Xcode에서 Sign in with Apple Capability를 추가합니다.",
        "substeps": [
          "Xcode에서 ios/Runner.xcworkspace 열기",
          "Runner 타겟 선택 > Signing & Capabilities",
          "'+ Capability' 버튼 클릭",
          "'Sign in with Apple' 추가"
        ],
        "note": "iOS 13.0 이상이 필요합니다."
      },
      {
        "stepNumber": 4,
        "title": "기본 로그인 구현",
        "description": "Sign in with Apple 버튼을 추가하고 인증을 처리합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/main.dart",
          "content": "import 'package:flutter/material.dart';\nimport 'package:sign_in_with_apple/sign_in_with_apple.dart';\n\nvoid main() {\n  runApp(const MyApp());\n}\n\nclass MyApp extends StatelessWidget {\n  const MyApp({super.key});\n\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      home: Scaffold(\n        appBar: AppBar(\n          title: const Text('Sign in with Apple'),\n        ),\n        body: Center(\n          child: SignInWithAppleButton(\n            onPressed: () async {\n              final credential = await SignInWithApple.getAppleIDCredential(\n                scopes: [\n                  AppleIDAuthorizationScopes.email,\n                  AppleIDAuthorizationScopes.fullName,\n                ],\n              );\n              \n              print('User ID: ${credential.userIdentifier}');\n              print('Email: ${credential.email}');\n              print('Name: ${credential.givenName} ${credential.familyName}');\n            },\n          ),\n        ),\n      ),\n    );\n  }\n}"
        }
      },
      {
        "stepNumber": 5,
        "title": "인증 정보 가져오기",
        "description": "Apple로부터 받은 credential을 처리합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/apple_auth.dart",
          "content": "final credential = await SignInWithApple.getAppleIDCredential(\n  scopes: [\n    AppleIDAuthorizationScopes.email,\n    AppleIDAuthorizationScopes.fullName,\n  ],\n);\n\n// 사용 가능한 정보\nfinal String userIdentifier = credential.userIdentifier; // 고유 ID (필수)\nfinal String? email = credential.email; // 이메일 (첫 로그인 시에만)\nfinal String? givenName = credential.givenName; // 이름 (첫 로그인 시에만)\nfinal String? familyName = credential.familyName; // 성 (첫 로그인 시에만)\nfinal String authorizationCode = credential.authorizationCode; // 서버 검증용\nfinal String? identityToken = credential.identityToken; // JWT 토큰"
        },
        "note": "이메일과 이름은 첫 로그인 시에만 제공됩니다. 반드시 저장해야 합니다!"
      },
      {
        "stepNumber": 6,
        "title": "Web 인증 설정 (선택사항)",
        "description": "Android 및 Web에서도 동작하도록 설정합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/web_auth.dart",
          "content": "import 'dart:io';\nimport 'package:flutter/foundation.dart';\n\nfinal credential = await SignInWithApple.getAppleIDCredential(\n  scopes: [\n    AppleIDAuthorizationScopes.email,\n    AppleIDAuthorizationScopes.fullName,\n  ],\n  webAuthenticationOptions: WebAuthenticationOptions(\n    // Apple Developer에서 생성한 Service ID\n    clientId: 'your.service.id',\n    // 리다이렉트 URI\n    redirectUri: kIsWeb\n        ? Uri.parse('https://your-domain.com/')\n        : Uri.parse('https://your-backend.com/callbacks/sign_in_with_apple'),\n  ),\n  // 보안을 위한 nonce와 state\n  nonce: 'example-nonce',\n  state: 'example-state',\n);"
        }
      },
      {
        "stepNumber": 7,
        "title": "백엔드 검증",
        "description": "서버에서 authorizationCode를 검증합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/backend_verification.dart",
          "content": "import 'package:http/http.dart' as http;\n\nfinal credential = await SignInWithApple.getAppleIDCredential(\n  scopes: [\n    AppleIDAuthorizationScopes.email,\n    AppleIDAuthorizationScopes.fullName,\n  ],\n);\n\n// 백엔드 엔드포인트로 credential 전송\nfinal signInEndpoint = Uri(\n  scheme: 'https',\n  host: 'your-backend.com',\n  path: '/sign_in_with_apple',\n  queryParameters: <String, String>{\n    'code': credential.authorizationCode,\n    if (credential.givenName != null)\n      'firstName': credential.givenName!,\n    if (credential.familyName != null)\n      'lastName': credential.familyName!,\n    if (credential.state != null)\n      'state': credential.state!,\n  },\n);\n\nfinal session = await http.Client().post(signInEndpoint);\nprint('Session created: ${session.body}');"
        }
      },
      {
        "stepNumber": 8,
        "title": "에러 처리",
        "description": "사용자 취소 및 기타 에러를 처리합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/error_handling.dart",
          "content": "try {\n  final credential = await SignInWithApple.getAppleIDCredential(\n    scopes: [\n      AppleIDAuthorizationScopes.email,\n      AppleIDAuthorizationScopes.fullName,\n    ],\n  );\n  \n  // 로그인 성공\n  print('Login successful: ${credential.userIdentifier}');\n  \n} on SignInWithAppleAuthorizationException catch (e) {\n  // Apple 인증 관련 에러\n  if (e.code == AuthorizationErrorCode.canceled) {\n    print('User canceled the sign-in flow');\n  } else if (e.code == AuthorizationErrorCode.failed) {\n    print('Authorization failed: ${e.message}');\n  } else {\n    print('Unknown authorization error: ${e.code}');\n  }\n} catch (e) {\n  // 기타 에러\n  print('Unexpected error: $e');\n}"
        }
      },
      {
        "stepNumber": 9,
        "title": "플랫폼별 버튼 스타일",
        "description": "SignInWithAppleButton의 스타일을 커스터마이징합니다.",
        "code": {
          "language": "dart",
          "filename": "lib/custom_button.dart",
          "content": "SignInWithAppleButton(\n  onPressed: () async {\n    // 로그인 로직\n  },\n  // 버튼 스타일\n  style: SignInWithAppleButtonStyle.black, // black, white, whiteOutline\n  \n  // 버튼 크기\n  height: 44, // Apple 권장 최소 높이\n  \n  // 버튼 텍스트\n  text: SignInWithAppleButtonText.signIn, // signIn, continueText, signUp\n  \n  // 아이콘과 텍스트 설정\n  iconAlignment: IconAlignment.center,\n)"
        }
      }
    ],
    "commonErrors": [
      {
        "error": "SignInWithAppleAuthorizationError: The operation couldn't be completed",
        "solution": "1. Xcode에서 'Sign in with Apple' Capability가 추가되었는지 확인\n2. Apple Developer에서 App ID에 Sign in with Apple이 활성화되어 있는지 확인\n3. iOS 13.0 이상인지 확인",
        "link": null
      },
      {
        "error": "이메일과 이름이 null로 반환됨",
        "solution": "이메일과 이름은 첫 로그인 시에만 제공됩니다. 테스트하려면:\n1. 설정 > Apple ID > 비밀번호 및 보안 > Apple로 로그인\n2. 해당 앱을 삭제하고 다시 시도",
        "link": null
      },
      {
        "error": "Web/Android에서 작동하지 않음",
        "solution": "webAuthenticationOptions를 설정하고, Apple Developer에서 Service ID와 Redirect URI를 올바르게 구성했는지 확인하세요.",
        "link": null
      }
    ],
    "tips": [
      "이메일과 이름은 첫 로그인 시에만 제공되므로 반드시 로컬 또는 서버에 저장하세요.",
      "userIdentifier는 앱별로 고유하며 항상 동일하게 유지됩니다.",
      "iOS 앱스토어 심사 시 다른 소셜 로그인이 있으면 Sign in with Apple도 필수입니다.",
      "Apple은 사용자가 이메일을 숨기고 relay 이메일을 제공할 수 있습니다.",
      "identityToken(JWT)을 백엔드에서 검증하여 보안을 강화하세요.",
      "테스트 시에는 시뮬레이터가 아닌 실제 기기를 사용하는 것이 좋습니다."
    ],
    "references": [
      {
        "title": "Sign in with Apple 공식 문서",
        "url": "https://pub.dev/packages/sign_in_with_apple"
      },
      {
        "title": "Apple Developer - Sign in with Apple",
        "url": "https://developer.apple.com/sign-in-with-apple/"
      },
      {
        "title": "App Store Review Guidelines",
        "url": "https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple"
      }
    ],
    "exampleCode": {
      "language": "dart",
      "fullExample": "import 'dart:io';\n\nimport 'package:flutter/foundation.dart';\nimport 'package:flutter/material.dart';\nimport 'package:http/http.dart' as http;\nimport 'package:sign_in_with_apple/sign_in_with_apple.dart';\n\nvoid main() {\n  runApp(const MyApp());\n}\n\nclass MyApp extends StatefulWidget {\n  const MyApp({super.key});\n\n  @override\n  State<MyApp> createState() => _MyAppState();\n}\n\nclass _MyAppState extends State<MyApp> {\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      onGenerateRoute: ((settings) {\n        print('onGenerateRoute: $settings');\n        return null;\n      }),\n      home: Scaffold(\n        appBar: AppBar(\n          title: const Text('Example app: Sign in with Apple'),\n        ),\n        body: Container(\n          padding: const EdgeInsets.all(10),\n          child: Center(\n            child: SignInWithAppleButton(\n              onPressed: () async {\n                final credential = await SignInWithApple.getAppleIDCredential(\n                  scopes: [\n                    AppleIDAuthorizationScopes.email,\n                    AppleIDAuthorizationScopes.fullName,\n                  ],\n                  webAuthenticationOptions: WebAuthenticationOptions(\n                    // TODO: clientId와 redirectUri를 Apple Developer 포털에서 설정한 값으로 변경하세요\n                    clientId: 'de.lunaone.flutter.signinwithappleexample.service',\n                    redirectUri: kIsWeb\n                        ? Uri.parse('https://\\${window.location.host}/')\n                        : Uri.parse(\n                            'https://flutter-sign-in-with-apple-example.glitch.me/callbacks/sign_in_with_apple',\n                          ),\n                  ),\n                  // TODO: 필요없으면 제거하세요\n                  nonce: 'example-nonce',\n                  state: 'example-state',\n                );\n\n                print(credential);\n\n                // Sign in with Apple로 받은 authorization code를\n                // 시스템의 세션으로 변환하는 엔드포인트\n                final signInWithAppleEndpoint = Uri(\n                  scheme: 'https',\n                  host: 'flutter-sign-in-with-apple-example.glitch.me',\n                  path: '/sign_in_with_apple',\n                  queryParameters: <String, String>{\n                    'code': credential.authorizationCode,\n                    if (credential.givenName != null)\n                      'firstName': credential.givenName!,\n                    if (credential.familyName != null)\n                      'lastName': credential.familyName!,\n                    'useBundleId': !kIsWeb && (Platform.isIOS || Platform.isMacOS)\n                        ? 'true'\n                        : 'false',\n                    if (credential.state != null) 'state': credential.state!,\n                  },\n                );\n\n                final session = await http.Client().post(\n                  signInWithAppleEndpoint,\n                );\n\n                // 여기까지 왔다면, Apple ID credential 기반의 세션이 생성되었습니다\n                // 이제 이것을 앱의 세션으로 설정할 수 있습니다\n                print(session);\n              },\n            ),\n          ),\n        ),\n      ),\n    );\n  }\n}"
    }
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const packageId = event.queryStringParameters?.packageId;

  if (!packageId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'packageId 파라미터가 필요합니다.'
      })
    };
  }

  const guide = GUIDES[packageId];

  if (!guide) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: `'${packageId}' 가이드를 찾을 수 없습니다.`,
        fallback: {
          message: 'pub.dev에서 공식 문서를 확인해주세요.',
          url: `https://pub.dev/packages/${packageId}`
        }
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      guide
    })
  };
};
