# 기술 스택 및 아키텍처

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 18.3, Vite 5.4 |
| **Backend** | Netlify Functions (Serverless) |
| **AI** | Google Gemini API |
| **Styling** | CSS (다크 모드, CSS Variables) |
| **Deploy** | Netlify |
| **Data** | 정적 JSON + pub.dev API |

---

## 작동 방식

```
[사용자 입력] → [Intent API] → [Gemini AI 분류] → [패키지 추천] → [가이드 생성]
```

### 핵심 흐름

1. **의도 분류** (`/api/intent`)
   - 사용자 메시지를 Gemini AI로 분류
   - 5가지 타입: `feature_request`, `package_query`, `smalltalk`, `clarify`, `live_guide`

2. **패키지 추천**
   - 로컬 큐레이션 DB 우선 조회
   - pub.dev API로 실시간 검색 보조
   - 관련성 + 품질 점수 기반 정렬

3. **가이드 생성** (`/api/guide`)
   - pub.dev에서 패키지 정보 스크래핑
   - Gemini AI로 단계별 가이드 생성

### 데이터 전략

```
/data/
├── meta.json          # 통계, 카테고리
├── top-100.json       # TOP 100 패키지
├── packages-lite.json # 전체 패키지 경량 목록
└── examples/          # 2000+ 사전 생성 가이드
```

- **정적 파일**: 빌드 시 생성, 30일 캐싱
- **런타임**: Gemini API 실시간 호출

---

## 한계점

### 1. 상태 관리
- Redux/Zustand 없이 Props Drilling 사용
- 복잡한 상태 공유 시 확장성 제한

### 2. 인증/보안
- 인증 시스템 미구현
- API 완전 공개 (CORS *)
- Rate Limiting 없음

### 3. AI 의존성
- Gemini API 장애 시 서비스 품질 저하
- API 호출 비용 증가 가능성
- 응답 시간이 AI 처리 속도에 종속

### 4. 데이터 동기화
- 정적 데이터는 수동 업데이트 필요 (월 1회)
- pub.dev 변경사항 실시간 반영 불가

### 5. 성능
- 대용량 리스트 가상화(Virtualization) 미적용
- 번들 코드 스플리팅 미적용
- 이미지 최적화 미적용

### 6. 테스트
- 유닛/E2E 테스트 부재
- CI/CD 자동화 테스트 없음

### 7. 타입 안정성
- TypeScript 미사용 (JavaScript)
- 런타임 타입 오류 가능성

---

## 개선 방향

| 한계점 | 해결책 |
|--------|--------|
| 상태 관리 | Zustand 또는 Jotai 도입 |
| 인증 | Netlify Identity / Supabase Auth |
| AI 의존성 | 응답 캐싱 강화, 폴백 로직 개선 |
| 타입 안정성 | TypeScript 마이그레이션 |
| 테스트 | Vitest + Playwright 도입 |
| 성능 | React.lazy, Suspense, 리스트 가상화 |
