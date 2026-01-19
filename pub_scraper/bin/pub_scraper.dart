import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

final List<Map<String, dynamic>> packageResults = [];

// GitHub Personal Access Token (환경변수 또는 직접 입력)
// 생성 방법: https://github.com/settings/tokens -> Generate new token (classic)
// 권한: public_repo 만 선택하면 됨
String? githubToken = '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';

// Fetch top Flutter packages from pub.dev (with pagination)
Future<List<String>> fetchTopFlutterPackages({int limit = 100}) async {
  final List<String> allPackages = [];
  int page = 1;

  try {
    while (allPackages.length < limit) {
      final url = Uri.parse('https://pub.dev/api/search?q=sdk:flutter&sort=popularity&page=$page');
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final packages = data['packages'] as List;

        if (packages.isEmpty) break;

        for (final pkg in packages) {
          if (allPackages.length >= limit) break;
          allPackages.add(pkg['package'] as String);
        }

        print('... 페이지 $page 완료 (${allPackages.length}/$limit 패키지)');
        page++;

        // Small delay to avoid rate limiting
        await Future.delayed(Duration(milliseconds: 200));
      } else {
        print('!!! Top packages 가져오기 실패 (Status ${response.statusCode})');
        break;
      }
    }

    return allPackages;
  } catch (e) {
    print('!!! Top packages 조회 중 오류 발생: $e');
    return allPackages;
  }
}

String? parseGitHubRepoUrl(String? url) {
  if (url == null) return null;
  if (url.endsWith('.git')) {
    url = url.substring(0, url.length - 4);
  }
  
  final uri = Uri.tryParse(url);
  if (uri != null && uri.host == 'github.com') {
    final pathSegments = uri.pathSegments;
    if (pathSegments.length >= 2) {
      return '${pathSegments[0]}/${pathSegments[1]}';
    }
  }
  return null;
}

// Fetch package score data from pub.dev
Future<Map<String, dynamic>> fetchPackageScore(String packageName) async {
  final url = Uri.parse('https://pub.dev/api/packages/$packageName/score');

  try {
    final response = await http.get(url);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return {
        'likeCount': data['likeCount'] ?? 0,
        'popularityScore': ((data['popularityScore'] ?? 0.0) * 100).round(),
        'pubPoints': data['grantedPoints'] ?? 0,
        'maxPoints': data['maxPoints'] ?? 0,
        'tags': data['tags'] ?? [],
      };
    } else {
      print('... Score 정보 가져오기 실패 (Status ${response.statusCode})');
      return {
        'likeCount': 0,
        'popularityScore': 0,
        'pubPoints': 0,
        'maxPoints': 0,
        'tags': [],
      };
    }
  } catch (e) {
    print('... Score 조회 중 오류 발생: $e');
    return {
      'likeCount': 0,
      'popularityScore': 0,
      'pubPoints': 0,
      'maxPoints': 0,
      'tags': [],
    };
  }
}

// GitHub API 헤더 생성
Map<String, String> get githubHeaders {
  final headers = {'User-Agent': 'my-pub-scraper-v1'};
  if (githubToken != null && githubToken!.isNotEmpty) {
    headers['Authorization'] = 'token $githubToken';
  }
  return headers;
}

// Fetch example code using GitHub Contents API (traverses directories dynamically)
Future<String?> fetchExampleCode(String ownerRepo, String packageName) async {
  final headers = githubHeaders;

  // Possible base paths to look for example directories
  final basePaths = [
    '', // root (example/)
    packageName, // package_name/example/ (simple monorepo)
    'pkgs/$packageName', // pkgs/package_name/example/
    'packages/$packageName', // packages/package_name/example/
    'packages/$packageName/$packageName', // packages/package_name/package_name/example/
    'third_party/packages/$packageName', // third_party/packages/package_name/example/ (flutter_svg)
    'packages/dart', // packages/dart/example/ (sentry)
    'packages/enhanced', // packages/enhanced/example/ (flutter_widget_from_html)
  ];

  // Try both "example" and "examples" folder names
  final exampleFolders = ['example', 'examples'];

  for (final basePath in basePaths) {
    for (final exampleFolder in exampleFolders) {
      final examplePath = basePath.isEmpty ? exampleFolder : '$basePath/$exampleFolder';
      final exampleFile = await _findExampleFileInDir(ownerRepo, examplePath, packageName, headers);
      if (exampleFile != null) {
        return exampleFile;
      }
    }
  }

  return null;
}

// Recursively search for example dart files in a directory
Future<String?> _findExampleFileInDir(String ownerRepo, String dirPath, String packageName, Map<String, String> headers) async {
  // Priority file names to look for (including package-named files)
  final priorityFiles = [
    'main.dart',
    'example.dart',
    '$packageName.dart',
    '${packageName}_example.dart', // e.g., synchronized_example.dart
  ];

  // Try multiple branches (some repos use develop)
  for (final branch in ['main', 'master', 'develop']) {
    final url = Uri.parse('https://api.github.com/repos/$ownerRepo/contents/$dirPath?ref=$branch');

    try {
      final response = await http.get(url, headers: headers);

      if (response.statusCode == 200) {
        final contents = jsonDecode(response.body);

        if (contents is List) {
          // First, check for lib subdirectory (common pattern: example/lib/main.dart)
          for (final item in contents) {
            if (item['type'] == 'dir' && item['name'] == 'lib') {
              final libResult = await _findExampleFileInDir(ownerRepo, item['path'], packageName, headers);
              if (libResult != null) return libResult;
            }
          }

          // Then check for priority files in current directory
          for (final priorityFile in priorityFiles) {
            for (final item in contents) {
              if (item['type'] == 'file' && item['name'] == priorityFile) {
                final content = await _fetchRawFile(ownerRepo, item['path'], branch, headers);
                if (content != null) return content;
              }
            }
          }

          // Finally, try any .dart file
          for (final item in contents) {
            if (item['type'] == 'file' && (item['name'] as String).endsWith('.dart')) {
              final content = await _fetchRawFile(ownerRepo, item['path'], branch, headers);
              if (content != null) return content;
            }
          }
        }

        return null; // Found directory but no suitable file
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

// Fetch raw file content
Future<String?> _fetchRawFile(String ownerRepo, String path, String branch, Map<String, String> headers) async {
  final url = Uri.parse('https://raw.githubusercontent.com/$ownerRepo/$branch/$path');
  try {
    final response = await http.get(url, headers: headers);
    if (response.statusCode == 200) {
      return response.body;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

//call GitHub API for more info.
Future<Map<String, dynamic>> fetchGitHubData(String ownerRepo) async {
  final url = Uri.parse('https://api.github.com/repos/$ownerRepo');
  final headers = githubHeaders;

  try {
    final response = await http.get(url, headers: headers);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return {
        'stars': data['stargazers_count'] ?? 0,
        'openIssues': data['open_issues_count'] ?? 0,
        'lastCommit': data['pushed_at']?.split('T')[0] ?? '날짜 정보 없음',
      };
    } else if (response.statusCode == 404) {
      print('... GitHub 저장소($ownerRepo)를 찾을 수 없음 (404)');
      return {'error': 'Repo not found'};
    } else {
      print('... GitHub API 호출 실패 ($ownerRepo) - Status ${response.statusCode}');
      if(response.body.contains('API rate limit exceeded')) {
         return {'error': 'API rate limit exceeded'};
      }
      return {'error': 'API call failed'};
    }
  } catch (e) {
    print('... GitHub API 호출 중 예외 발생 ($ownerRepo): $e');
    return {'error': e.toString()};
  }
}

void main() async {
  print('===== pub.dev + GitHub 패키지 정보 수집 시작 =====');

  // GitHub 토큰 확인
  if (githubToken == null || githubToken!.isEmpty) {
    print('⚠️  GITHUB_TOKEN 환경변수가 설정되지 않았습니다.');
    print('   GitHub API 호출 제한: 60회/시간 (토큰 사용 시: 5,000회/시간)');
    print('   토큰 생성: https://github.com/settings/tokens\n');
  } else {
    print('✓ GitHub 토큰이 설정되었습니다.\n');
  }

  // Fetch top 100 Flutter packages dynamically
  print('\n... 상위 100개 Flutter 패키지 목록 가져오는 중...');
  final packageNames = await fetchTopFlutterPackages(limit: 100);

  if (packageNames.isEmpty) {
    print('!!! 패키지 목록을 가져올 수 없습니다.');
    return;
  }

  print('... ${packageNames.length}개 패키지 발견!\n');

  for (final name in packageNames) {
    print('\n... [1/4] "$name" 패키지 (pub.dev) 정보 가져오는 중...');

    try {
      final pubUrl = Uri.parse('https://pub.dev/api/packages/$name');
      final pubResponse = await http.get(pubUrl);

      if (pubResponse.statusCode == 200) {
        final data = jsonDecode(pubResponse.body);

        //for null
        final latest = data['latest'];
        final pubspec = latest?['pubspec'];
        final publisher = data['publisher'];
        final description = pubspec?['description'] ?? '설명 없음';
        final license = pubspec?['license'] ?? '라이선스 미표기';
        final githubRepoUrl = pubspec?['repository'] ?? pubspec?['homepage'];
        final lastUpdated = latest?['published']?.split('T')[0] ?? '날짜 정보 없음';
        final publisherId = publisher?['id'] ?? '게시자 정보 없음';
        final topics = (pubspec?['topics'] as List?)?.cast<String>() ?? [];
        final dependencies = pubspec?['dependencies']?.keys.toList() ?? [];

        // Fetch score data from separate endpoint
        print('... [2/4] "$name" 패키지 점수 정보 가져오는 중...');
        final scoreData = await fetchPackageScore(name);

        final Map<String, dynamic> extractedData = {
          'packageName': name,
          'description': description,
          'url': 'https://pub.dev/packages/$name',
          'githubRepoUrl': githubRepoUrl ?? 'GitHub 정보 없음',
          'score': {
            'likes': scoreData['likeCount'],
            'popularityScore': scoreData['popularityScore'],
            'pubPoints': scoreData['pubPoints'],
            'maxPoints': scoreData['maxPoints'],
          },
          'tags': topics,
          'apiTags': scoreData['tags'],
          'dependencies': dependencies,
          'maintenance': {
            'lastUpdated_pub': lastUpdated,
            'publisher': publisherId
          },
          'license': license,
          'githubInfo': <String, dynamic>{},
          'exampleCode': null,
        };

        // --- GitHub data link ---
        final ownerRepo = parseGitHubRepoUrl(githubRepoUrl);
        if (ownerRepo != null) {
          print('... [3/4] "$name" 패키지 (GitHub: $ownerRepo) 정보 가져오는 중...');
          final githubInfo = await fetchGitHubData(ownerRepo);
          extractedData['githubInfo'] = githubInfo;

          // Fetch example code
          print('... [4/4] "$name" 패키지 예제 코드 가져오는 중...');
          final exampleCode = await fetchExampleCode(ownerRepo, name);
          if (exampleCode != null) {
            extractedData['exampleCode'] = exampleCode;
            print('... 예제 코드 발견!');
          } else {
            print('... 예제 코드를 찾을 수 없음.');
          }
        } else {
          print('... [3/4] "$name" 패키지의 GitHub 저장소 URL을 찾을 수 없음.');
          print('... [4/4] 예제 코드 스킵 (GitHub 정보 없음)');
        }

        packageResults.add(extractedData);
        print('... "$name" 정보 추출 완료!');

        // Add delay to avoid rate limiting
        await Future.delayed(Duration(milliseconds: 500));

      } else {
        print('!!! "$name" (pub.dev) 정보 가져오기 실패 (Status ${pubResponse.statusCode})');
      }
    } catch (e) {
      print('!!! "$name" 처리 중 오류 발생: $e');
    }
  }

  if (packageResults.isNotEmpty) {
    final file = File('top_flutter_packages.json');
    final encoder = JsonEncoder.withIndent('  ');
    final jsonString = encoder.convert(packageResults);

    await file.writeAsString(jsonString);
    print('\n===== 작업 완료! "top_flutter_packages.json" 파일이 생성되었습니다. =====');
  } else {
    print('\n===== 저장할 데이터가 없습니다. =====');
  }
}