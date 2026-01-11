# 📦 Flutter 패키지 검색 시스템

모든 Flutter 패키지에 대한 질문에 답변할 수 있는 하이브리드 검색 시스템입니다.

## 🎯 작동 방식

### 3단계 검색 시스템

```
사용자: "http 패키지 알려줘"
   ↓
1️⃣ top_flutter_packages.json (100개) 검색
   ✅ 있으면 즉시 반환
   ❌ 없으면 ↓

2️⃣ generated-guides/ 폴더 검색
   ✅ 이전에 생성한 가이드가 있으면 반환
   ❌ 없으면 ↓

3️⃣ pub.dev 실시간 조회 + Gemini 가이드 생성
   → 생성된 가이드를 파일로 저장 (다음번 사용)
   → 반환
```

## 📂 파일 구조

```
/React
├── top_flutter_packages.json          # 100개 패키지 원본 데이터
├── generate-guides.js                 # 가이드 자동 생성 스크립트
├── test-package-search.js             # 로컬 테스트 스크립트
├── all-package-guides.txt             # 100개 통합 가이드 (생성 후)
├── generated-guides/                  # 개별 가이드 파일들
│   ├── http.txt
│   ├── provider.txt
│   └── ... (100개+)
├── backend/
│   └── services/
│       ├── pubdev-api.js              # pub.dev API 연동
│       └── package-search.js          # 패키지 검색 로직
└── netlify/functions/
    ├── intent.js                      # 챗봇 분류 (수정됨)
    └── package-query.js               # 패키지 조회 엔드포인트 (신규)
```

## 🚀 사용 방법

### 1. 100개 패키지 가이드 생성

이미 백그라운드로 실행 중입니다. 완료까지 약 2시간 소요됩니다.

```bash
# 진행 상황 확인
tail -f guide-generation.log

# 또는 수동 실행
node generate-guides.js 100
```

### 2. 로컬 테스트

```bash
node test-package-search.js
```

이 스크립트는:
- top100에 있는 패키지 (http, provider)
- pub.dev에서 조회될 패키지 (get_it)
를 테스트합니다.

### 3. Netlify 함수 사용

#### A. 챗봇 분류 (기존)

```bash
POST /.netlify/functions/intent
Content-Type: application/json

{
  "message": "http 패키지 알려줘"
}
```

**응답:**
```json
{
  "type": "package_query",
  "intent": "auth_basic",
  "packageName": "http",
  "source": "ai"
}
```

#### B. 패키지 조회 (신규)

```bash
POST /.netlify/functions/package-query
Content-Type: application/json

{
  "packageName": "http"
}
```

**응답:**
```json
{
  "success": true,
  "packageName": "http",
  "source": "pregenerated",
  "guide": "Q: http 패키지가 뭐야?\n\nA: ...",
  "packageInfo": { ... }
}
```

## 💡 챗봇 통합 예시

```javascript
// 1. 사용자 메시지 분류
const classifyResponse = await fetch('/.netlify/functions/intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userMessage })
});

const { type, packageName } = await classifyResponse.json();

// 2. package_query 타입이면 패키지 조회
if (type === 'package_query' && packageName) {
  const packageResponse = await fetch('/.netlify/functions/package-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageName })
  });

  const { guide, source } = await packageResponse.json();

  // 3. 사용자에게 가이드 표시
  console.log(`[${source}] ${guide}`);
}
```

## 📊 성능 예상

### 응답 속도

- **100개 사전 생성 패키지**: 0.1초 (즉시)
- **캐시된 패키지**: 0.1초 (즉시)
- **pub.dev 실시간 조회**: 5-10초 (첫 요청만)

### 비용 (Gemini API)

- **초기 투자**: 100개 생성 약 $2-3 (1회성)
- **운영 비용**: 월 $5-15 (새 패키지 조회분)

### 커버리지

- **즉시 응답**: 100개 (상위 인기 패키지)
- **1달 후**: 300-500개 (자주 묻는 패키지 캐시됨)
- **3달 후**: 1000개+ (대부분 캐시됨)

## 🔧 트러블슈팅

### "GEMINI_API_KEY가 설정되지 않았습니다"

`backend/.env` 파일에 API 키를 추가하세요:

```
GEMINI_API_KEY=your-api-key-here
```

### 패키지를 찾을 수 없음 (404)

1. pub.dev에서 패키지명 확인
2. 패키지명이 정확한지 확인 (대소문자 구분)

### 가이드 생성 실패

Gemini API가 없어도 기본 가이드는 생성됩니다. 하지만 품질이 낮을 수 있습니다.

## 📈 확장 가능성

### 더 많은 패키지 사전 생성

```bash
# 500개 생성 (약 10시간 소요)
node generate-guides.js 500
```

### 캐시 관리

```bash
# 생성된 가이드 개수 확인
ls generated-guides/*.txt | wc -l

# 특정 패키지 가이드 삭제 (재생성하려면)
rm generated-guides/http.txt
```

## 🎉 완성!

이제 **모든 Flutter 패키지**에 대한 질문에 답변할 수 있습니다!

- 100개는 즉시 응답
- 나머지는 5-10초 후 응답 (한번만)
- 비용 효율적
- 자동으로 캐시 확장
