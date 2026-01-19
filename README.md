# Flutter Package Guide - 빠른 시작 가이드

## 🚀 5분 안에 시작하기

### 1. 환경 설정

```bash
# 1. .env 파일 생성
echo "GEMINI_API_KEY=your_api_key_here" > .env
echo "GEMINI_MODEL=gemini-2.0-flash" >> .env

# 2. 의존성 설치
npm install
```

### 2. 로컬 실행

```bash
npm run dev
```

브라우저에서 http://localhost:8888 접속

### 3. API 테스트

```bash
# 헬스 체크
curl http://localhost:8888/api/health

# 가이드 생성 (dio 패키지)
curl "http://localhost:8888/api/guide?packageId=dio"

# 인텐트 분류
curl -X POST http://localhost:8888/api/intent \
  -H "Content-Type: application/json" \
  -d '{"message": "로그인 기능 만들고 싶어"}'
```

---

## 📁 주요 파일

| 파일 | 설명 |
|------|------|
| `backend/config/constants.js` | 상수 정의 (API URL, 캐시 TTL 등) |
| `backend/services/guideGenerator.service.js` | AI 가이드 생성 로직 |
| `backend/adapters/gemini.adapter.js` | Gemini API 클라이언트 |
| `netlify/functions/api-guide.js` | 가이드 API 엔드포인트 |
| `netlify/functions/api-intent.js` | 인텐트 분류 API |

---

## 🔧 주요 명령어

```bash
# 패키지 인덱스 수집 (최초 1회)
npm run collect-index

# 인기 패키지 캐시 워밍업
npm run warmup-cache

# 로컬 개발 서버
npm run dev

# 프론트엔드 빌드
npm run build
```

---

## 📊 데이터 흐름

```
사용자 요청
    ↓
Netlify Function (api-guide.js)
    ↓
Service Layer (guideGenerator.service.js)
    ↓
Cache Check (cache.service.js)
    ↓ (캐시 미스)
Package Info (packageInfo.service.js)
    ↓
pub.dev API + Scraper
    ↓
Gemini AI (gemini.adapter.js)
    ↓
Cache Save
    ↓
응답 반환
```

---

## ⚡ 성능 최적화

### 캐싱 전략
- **패키지 정보**: 24시간 캐싱
- **가이드**: 버전별 영구 캐싱
- **메모리 + 파일 시스템** 2단계 캐싱

### Rate Limit 대응
- 자동 재시도 (지수 백오프)
- 요청 간 500ms 대기
- 최대 5회 재시도

---

## 🐛 자주 발생하는 오류

### 1. "GEMINI_API_KEY is required"
→ `.env` 파일에 API 키 추가

### 2. "429 Too Many Requests"
→ 자동 재시도됨, 잠시 대기

### 3. "Package not found"
→ 패키지 이름 확인 (pub.dev에 존재하는지)

---

## 📚 더 알아보기

- [전체 사용자 가이드](./user_guide.md)
- [구현 계획](./implementation_plan.md)
- [pub.dev API 문서](https://pub.dev/help/api)
- [Gemini API 문서](https://ai.google.dev/docs)
