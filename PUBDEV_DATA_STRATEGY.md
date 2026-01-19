# pub.dev 전체 패키지 데이터 로딩 전략

## 현재 상황 분석

### 현재 구현
- pub.dev API에서 **3페이지(약 300개)** 패키지만 동적 로드
- 1시간 캐싱 (서버리스 환경에서 제한적)
- 매 요청마다 pub.dev API 호출 → Rate Limit 위험

### 문제점
1. 전체 패키지의 극히 일부만 표시
2. API Rate Limit (429 에러) 위험
3. 서버리스 환경에서 캐시 휘발성
4. 사용자 경험: 초기 로딩 느림

---

## 제안 전략: **Pre-built Static Data + GitHub Actions**

### 핵심 아이디어
```
[월 1회 자동 수집] → [JSON 파일 생성] → [GitHub 저장소 커밋] → [Netlify 빌드] → [정적 파일로 서빙]
```

### 왜 이 방식인가?

| 방식 | 장점 | 단점 |
|------|------|------|
| **실시간 API 호출** | 항상 최신 | Rate Limit, 느림, 비용 |
| **서버 캐시** | 빠름 | 서버리스에서 휘발, 복잡 |
| **DB 저장** | 유연함 | 추가 인프라 비용 |
| **정적 파일 (추천)** | 무료, 빠름, 안정 | 갱신 주기 필요 |

월 1회 갱신이면 충분하다고 했으므로 **정적 파일 방식**이 가장 현실적입니다.

---

## 구현 계획

### Phase 1: 데이터 수집 스크립트

#### 1.1 새 스크립트 생성
```
scripts/
├── collect-all-packages.js    # 전체 패키지 수집
├── process-package-data.js    # 데이터 가공
└── generate-static-data.js    # 정적 파일 생성
```

#### 1.2 수집 대상 데이터
```javascript
{
  // 메타 정보
  lastUpdated: "2024-01-15T00:00:00Z",
  totalPackages: 55000,

  // 패키지 목록 (전체)
  packages: [
    {
      name: "provider",
      description: "A wrapper around InheritedWidget...",
      version: "6.1.1",
      likes: 8500,
      pubPoints: 160,
      popularity: 99,
      platforms: ["android", "ios", "web", "macos", "windows", "linux"],
      tags: ["state-management", "flutter-favorite"],
      publisher: "dash-overflow.net",
      updated: "2024-01-10"
    },
    // ... 모든 패키지
  ],

  // 사전 계산된 뷰 (빠른 접근용)
  views: {
    topByLikes: [...],      // 상위 100개
    topByPopularity: [...], // 상위 100개
    flutterFavorites: [...], // Flutter Favorite 패키지
    byPlatform: {
      android: [...],
      ios: [...],
      web: [...]
    },
    byTag: {
      "state-management": [...],
      "networking": [...]
    }
  },

  // 통계
  stats: {
    totalPackages: 55000,
    totalLikes: 2500000,
    avgPubPoints: 85,
    platformCounts: {...},
    tagCounts: {...}
  }
}
```

#### 1.3 Rate Limit 대응 전략
```javascript
// 수집 전략
const COLLECTION_CONFIG = {
  batchSize: 100,           // 한 번에 100개씩 요청
  delayBetweenBatches: 2000, // 배치 간 2초 대기
  maxRetries: 3,            // 실패 시 3회 재시도
  retryDelay: 5000,         // 재시도 전 5초 대기

  // 예상 시간: 55,000개 / 100개 * 2초 = 약 18분
};
```

### Phase 2: GitHub Actions 자동화

#### 2.1 워크플로우 파일
```yaml
# .github/workflows/update-package-data.yml
name: Update pub.dev Package Data

on:
  schedule:
    - cron: '0 0 1 * *'  # 매월 1일 자정 (UTC)
  workflow_dispatch:      # 수동 실행 가능

jobs:
  update-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Collect package data
        run: node scripts/collect-all-packages.js

      - name: Process and generate static files
        run: node scripts/generate-static-data.js

      - name: Commit and push
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add data/
          git commit -m "chore: update pub.dev package data [$(date +'%Y-%m-%d')]" || exit 0
          git push
```

### Phase 3: 정적 데이터 파일 구조

#### 3.1 파일 분할 (성능 최적화)
```
data/
├── meta.json              # 메타정보, 통계 (~1KB)
├── packages-full.json     # 전체 패키지 (~15MB, 압축 시 ~2MB)
├── packages-lite.json     # 경량 버전 (~3MB, 압축 시 ~500KB)
│                          # (name, likes, popularity, platforms만)
├── views/
│   ├── top-100.json       # 인기 상위 100개 (~50KB)
│   ├── flutter-favorites.json
│   ├── by-platform.json
│   └── by-tag.json
└── search-index.json      # 검색용 인덱스 (~2MB)
```

#### 3.2 경량 버전 vs 전체 버전
```javascript
// packages-lite.json (초기 로딩용)
[
  { name: "provider", likes: 8500, popularity: 99, platforms: [...] },
  // 필수 필드만
]

// packages-full.json (상세 정보 필요시)
[
  { name: "provider", description: "...", version: "...", tags: [...], ... },
  // 모든 필드
]
```

### Phase 4: 프론트엔드 데이터 로딩

#### 4.1 초기 로딩 전략
```javascript
// 1단계: 메타 + 인기 패키지 로드 (즉시)
const [meta, topPackages] = await Promise.all([
  fetch('/data/meta.json').then(r => r.json()),
  fetch('/data/views/top-100.json').then(r => r.json())
]);

// 2단계: 경량 전체 목록 로드 (백그라운드)
const allPackagesLite = await fetch('/data/packages-lite.json').then(r => r.json());

// 3단계: 필요시 상세 정보 로드 (온디맨드)
const getPackageDetail = async (name) => {
  // 캐시된 full 데이터에서 찾거나
  // pub.dev API 실시간 호출
};
```

#### 4.2 검색 구현
```javascript
// 클라이언트 사이드 검색 (Fuse.js 사용)
import Fuse from 'fuse.js';

const fuse = new Fuse(allPackagesLite, {
  keys: ['name', 'description'],
  threshold: 0.3
});

const searchPackages = (query) => fuse.search(query);
```

### Phase 5: Netlify 설정

#### 5.1 정적 파일 서빙 최적화
```toml
# netlify.toml 추가
[[headers]]
  for = "/data/*"
  [headers.values]
    Cache-Control = "public, max-age=2592000"  # 30일 캐싱

[[headers]]
  for = "/data/*.json"
  [headers.values]
    Content-Type = "application/json; charset=utf-8"
```

#### 5.2 Gzip 압축
Netlify는 자동으로 정적 파일 Gzip 압축 적용 (15MB → ~2MB)

---

## 구현 우선순위

### 1단계 (필수)
- [ ] `scripts/collect-all-packages.js` 작성
- [ ] `scripts/generate-static-data.js` 작성
- [ ] 로컬에서 데이터 수집 테스트

### 2단계 (자동화)
- [ ] GitHub Actions 워크플로우 설정
- [ ] 수동 실행 테스트

### 3단계 (프론트엔드)
- [ ] 홈페이지 데이터 로딩 수정
- [ ] 검색 기능 클라이언트 사이드로 전환
- [ ] 로딩 상태 UI 개선

### 4단계 (최적화)
- [ ] 파일 분할 적용
- [ ] 점진적 로딩 구현
- [ ] 오프라인 캐싱 (Service Worker)

---

## 예상 결과

### Before (현재)
```
- 패키지 수: 300개
- 초기 로딩: 2-5초 (API 호출)
- Rate Limit 위험: 높음
- 데이터 신선도: 실시간
```

### After (구현 후)
```
- 패키지 수: 55,000+개
- 초기 로딩: <1초 (정적 파일)
- Rate Limit 위험: 없음
- 데이터 신선도: 월 1회 갱신
```

---

## 비용

| 항목 | 비용 |
|------|------|
| GitHub Actions | 무료 (월 2000분 제공) |
| Netlify 정적 호스팅 | 무료 (100GB/월) |
| 추가 인프라 | 불필요 |

**총 비용: $0**

---

## 주의사항

1. **pub.dev API 정책 준수**
   - robots.txt 확인
   - User-Agent 명시
   - Rate Limit 준수 (과도한 요청 자제)

2. **대용량 JSON 처리**
   - 스트리밍 파싱 고려
   - 웹 워커 사용 검토

3. **버전 관리**
   - 데이터 파일에 lastUpdated 포함
   - 이전 버전 롤백 가능하도록

---

## 다음 단계

이 계획이 괜찮다면 구현을 시작하겠습니다. 어떤 부분부터 진행할까요?

1. **데이터 수집 스크립트** 먼저 작성
2. **GitHub Actions** 설정
3. **프론트엔드** 수정
