# Flutter Package Guide 시스템 - 오늘 배포 작업 목록

## 목표
> 사용자가 Flutter 패키지 이름을 질문하면, pub.dev의 정보를 기반으로 AI가 구현 가이드를 제공하는 시스템

---

## 현재 문제 요약

| 문제 | 원인 | 영향 |
|------|------|------|
| "어떤 Flutter 기능을 구현하고 싶은지..." 메시지 출력 | `package_query` 타입이 ALLOWED_TYPES에 없음 | 패키지 직접 질문이 전부 실패 |
| 20개 생성된 가이드 사용 불가 | guideLoader가 JSON만 읽음 | generated-guides/*.txt 무용지물 |
| 새 패키지 질문 대응 불가 | 실시간 가이드 생성 기능 없음 | 사전 정의된 패키지만 지원 |

---

## 작업 목록 (우선순위순)

### Phase 1: 긴급 수정 (기존 기능 정상화) ⏱️ 30분

#### 1-1. package_query 타입 활성화
**파일:** `netlify/functions/utils/constants.js`
```javascript
// 수정: ALLOWED_TYPES에 package_query 추가
export const ALLOWED_TYPES = [
  'feature_request',
  'followup_question',
  'smalltalk',
  'clarify',
  'package_query',  // ← 추가
]
```

#### 1-2. Gemini 프롬프트에 package_query 분류 규칙 추가
**파일:** `netlify/functions/utils/gemini.js`

프롬프트에 추가할 내용:
```
1. TYPE에 추가:
   - "package_query" = 특정 패키지 사용법, 예제, 가이드 질문
     (flutter_bloc 어떻게 써?, dio 사용법, provider 예제 보여줘)

2. EXAMPLES에 추가:
   Input: "flutter_bloc 사용법" → Output: {"type":"package_query","intent":"auth_basic","packageName":"flutter_bloc"}
   Input: "dio 어떻게 써?" → Output: {"type":"package_query","intent":"auth_basic","packageName":"dio"}
   Input: "provider 예제" → Output: {"type":"package_query","intent":"auth_basic","packageName":"provider"}
```

응답 형식도 수정 필요:
```
Return format: {"type":"...","intent":"...","packageName":"..."}
(packageName은 package_query일 때만 포함)
```

#### 1-3. 기존 txt 가이드 파일 사용하도록 수정
**파일:** `netlify/functions/utils/guideLoader.js`

수정 로직:
```
1. /data/examples/{packageId}.json 먼저 확인
2. 없으면 /generated-guides/{packageId}.txt 확인
3. txt 파일이면 { plainText: 내용 } 형태로 반환
```

---

### Phase 2: pub.dev 연동 (실시간 가이드 생성) ⏱️ 1시간

#### 2-1. pub.dev API 유틸 함수 생성
**새 파일:** `netlify/functions/utils/pubdevApi.js`

```javascript
// 구현할 함수들:

// 1. 패키지 기본 정보 가져오기
async function getPackageInfo(packageName)
// API: GET https://pub.dev/api/packages/{packageName}
// 반환: { name, version, description, homepage, repository }

// 2. 패키지 점수/인기도 가져오기
async function getPackageScore(packageName)
// API: GET https://pub.dev/api/packages/{packageName}/score
// 반환: { likeCount, popularityScore, grantedPoints }

// 3. README 내용 가져오기 (example 포함 가능)
async function getPackageReadme(packageName)
// 방법: pub.dev 페이지에서 README 섹션 추출
// 또는 GitHub repo의 README.md 가져오기
```

#### 2-2. 실시간 가이드 생성 함수
**새 파일:** `netlify/functions/utils/guideGenerator.js`

```javascript
async function generateGuideFromPubDev(packageName) {
  // 1. pub.dev에서 패키지 정보 가져오기
  const packageInfo = await getPackageInfo(packageName)

  // 2. Gemini 프롬프트 구성
  const prompt = `
    패키지: ${packageName}
    설명: ${packageInfo.description}
    버전: ${packageInfo.version}

    이 Flutter 패키지의 구현 가이드를 작성해주세요:
    1. 설치 방법 (pubspec.yaml)
    2. 기본 사용법 (코드 예제)
    3. 주요 기능 설명
    4. 흔한 에러와 해결법
    5. 베스트 프랙티스
  `

  // 3. Gemini로 가이드 생성
  const guide = await callGeminiForGuide(prompt)

  // 4. 캐싱 (선택)

  return guide
}
```

#### 2-3. guide.js 수정 (실시간 생성 로직 추가)
**파일:** `netlify/functions/guide.js`

```javascript
// 수정된 로직:
export async function handler(event, context) {
  const packageId = event.queryStringParameters?.packageId

  // 1단계: 캐시된 가이드 확인 (JSON 또는 TXT)
  let guide = loadGuide(packageId)

  // 2단계: 없으면 실시간 생성
  if (!guide) {
    guide = await generateGuideFromPubDev(packageId)
  }

  // 3단계: 그래도 없으면 에러
  if (!guide) {
    return { error: '가이드 생성 실패' }
  }

  return { success: true, guide }
}
```

---

### Phase 3: 프론트엔드 개선 ⏱️ 30분

#### 3-1. 로딩 상태 개선
**파일:** `frontend/src/components/PackageCards.jsx`

- 가이드 생성 중 로딩 표시 (실시간 생성은 시간 소요)
- "AI가 가이드를 생성하고 있습니다..." 메시지

#### 3-2. 에러 처리 개선
**파일:** `frontend/src/components/GuideModal.jsx`

- pub.dev에 없는 패키지 처리
- API 실패 시 fallback 메시지

---

## 파일 수정 체크리스트

### 백엔드 (netlify/functions/)
- [ ] `utils/constants.js` - ALLOWED_TYPES에 package_query 추가
- [ ] `utils/gemini.js` - 프롬프트 수정 (package_query 분류 + packageName 추출)
- [ ] `utils/guideLoader.js` - txt 파일도 로드하도록 수정
- [ ] `utils/pubdevApi.js` - 새로 생성 (pub.dev API 호출)
- [ ] `utils/guideGenerator.js` - 새로 생성 (실시간 가이드 생성)
- [ ] `guide.js` - 실시간 생성 로직 추가
- [ ] `intent.js` - packageName 반환하도록 수정

### 프론트엔드 (frontend/src/)
- [ ] `components/PackageCards.jsx` - 로딩 상태 개선
- [ ] `components/GuideModal.jsx` - 에러 처리 개선
- [ ] `components/Chat.jsx` - package_query 응답 메시지 개선

---

## 데이터 흐름 (최종 설계)

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 질문                               │
│                 "flutter_bloc 사용법 알려줘"                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POST /api/intent                              │
│                                                                  │
│  Gemini 분류 결과:                                                │
│  {                                                               │
│    type: "package_query",                                        │
│    intent: "auth_basic",                                         │
│    packageName: "flutter_bloc"                                   │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    프론트엔드 처리                                │
│                                                                  │
│  1. 패키지 카드 표시 (flutter_bloc)                               │
│  2. "구현 가이드" 버튼 활성화                                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                        [사용자가 버튼 클릭]
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GET /api/guide?packageId=flutter_bloc         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1단계: 캐시 확인                                          │    │
│  │   - /data/examples/flutter_bloc.json 있나? → NO          │    │
│  │   - /generated-guides/flutter_bloc.txt 있나? → YES ✓     │    │
│  │   → 있으면 바로 반환                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                    [캐시 없으면]                                  │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2단계: pub.dev API 호출                                   │    │
│  │   GET https://pub.dev/api/packages/flutter_bloc          │    │
│  │   → { name, description, version, homepage }             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 3단계: Gemini로 가이드 생성                               │    │
│  │   - 패키지 정보 + 프롬프트 전달                            │    │
│  │   - 구현 가이드 생성 (설치, 사용법, 예제, 에러 등)          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4단계: 응답 반환 (+ 선택적 캐싱)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GuideModal 표시                               │
│                                                                  │
│  - 구조화된 가이드 (JSON) 또는 평문 가이드 (TXT/생성)             │
│  - 코드 복사 기능                                                 │
│  - 단계별 아코디언                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## pub.dev API 상세 정보

### 1. 패키지 정보 API
```
GET https://pub.dev/api/packages/{packageName}

응답 예시:
{
  "name": "flutter_bloc",
  "latest": {
    "version": "8.1.3",
    "pubspec": {
      "name": "flutter_bloc",
      "description": "Flutter Widgets that make it easy to implement...",
      "homepage": "https://github.com/felangel/bloc"
    }
  }
}
```

### 2. 패키지 점수 API
```
GET https://pub.dev/api/packages/{packageName}/score

응답 예시:
{
  "grantedPoints": 140,
  "maxPoints": 150,
  "likeCount": 8234,
  "popularityScore": 0.98
}
```

### 3. Example 코드 가져오기 (GitHub 연동 필요)
```
1. pub.dev API에서 repository URL 추출
2. GitHub API로 example/ 폴더 내용 가져오기
   GET https://api.github.com/repos/{owner}/{repo}/contents/example

주의: GitHub API rate limit 있음 (인증 없이 60회/시간)
```

---

## 배포 전 테스트 시나리오

### 테스트 1: package_query 분류
```
입력: "flutter_bloc 어떻게 써?"
기대: type="package_query", packageName="flutter_bloc"
```

### 테스트 2: 기존 txt 가이드 로드
```
입력: 가이드 버튼 클릭 (dio)
기대: /generated-guides/dio.txt 내용 표시
```

### 테스트 3: 실시간 가이드 생성
```
입력: 가이드 버튼 클릭 (get_it - 캐시 없는 패키지)
기대: pub.dev에서 정보 가져와서 AI 가이드 생성
```

### 테스트 4: 존재하지 않는 패키지
```
입력: "asdfasdf1234 사용법"
기대: "해당 패키지를 찾을 수 없습니다" 에러 처리
```

---

## 예상 소요 시간

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| 1 | 긴급 수정 (package_query 활성화 + txt 로드) | 30분 |
| 2 | pub.dev API 연동 + 실시간 생성 | 1시간 |
| 3 | 프론트엔드 개선 | 30분 |
| - | 테스트 및 디버깅 | 30분 |
| **총** | | **2시간 30분** |

---

## 우선순위 결정

### 오늘 반드시 해야 할 것 (MVP)
1. ✅ package_query 타입 활성화
2. ✅ 기존 txt 가이드 사용
3. ✅ 기본 에러 처리

### 시간 여유 있으면 추가
4. ⬜ pub.dev 실시간 연동
5. ⬜ 가이드 캐싱

### 나중에 해도 되는 것
6. ⬜ GitHub example 코드 가져오기
7. ⬜ 가이드 품질 개선 (더 상세한 프롬프트)

---

## 시작하기

Phase 1부터 순서대로 진행. 각 단계 완료 후 로컬 테스트 필수.

```bash
# 로컬 테스트
cd /Users/serendi/Desktop/Develop/React
netlify dev
```
