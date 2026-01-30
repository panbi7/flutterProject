# 웹 작동 핵심 흐름

1. **데이터 수집 및 갱신**
   - 매월 1일 00:00 UTC(한국 시간 오전 9시)에 `.github/workflows/update-package-data.yml`와 `.github/workflows/monthly-update.yml`가 실행되며, 두 워크플로 모두 `npm run collect`(`scripts/collect-all-packages.js`)로 `data/all-packages.json`을 최신화하고 `npm run generate`(`scripts/generate-static-data.js`)으로 정적 JSON들을 재생성합니다.
   - 수동 실행(Workflow Dispatch)도 가능하며, `update-package-data` 워크플로는 `skip_collection` 입력으로 수집을 건너뛰거나 `--resume` 옵션으로 이전 진행을 이어갈 수 있습니다.

2. **정적 데이터 생성**
   - `scripts/generate-static-data.js`가 `data/all-packages.json`을 열어 `frontend/public/data/` 아래에 `meta.json`, `packages-lite.json`, `top-100.json`, `monthly-widgets.json` 등을 만듭니다.
   - `packages-lite.json`은 이름/요약/인기점수 등 UI 사용에 필요한 최소 필드만 담아 프런트엔드 초기 로딩을 빠르게 하고, `meta.json`은 총 패키지 수·태그 통계 같은 메타 정보를 제공합니다.

3. **프런트엔드 사용**
   - `frontend` 앱은 `frontend/public/data/` 밑의 정적 JSON을 로딩해 패키지 목록, 인기 차트, 월간 추천 위젯 등을 렌더링합니다. 전체 데이터를 다시 수집할 필요 없이 `packages-lite.json`만으로 대부분 UI를 구성할 수 있으며, `meta.json`으로 통계 기반 UI를 보강합니다.

4. **구현 가이드 노출 흐름**
   - 홈 화면(`frontend/src/components/HomePage.jsx`)에서 인기 위젯/Top10/최근 업데이트 카드에 있는 `구현 가이드` 버튼을 누르면 `frontend/src/services/guideApi.js`의 캐시 우선 로직을 거쳐 `/api/guide?packageId={패키지}` Netlify 함수(`netlify/functions/api-guide.js`)에 요청합니다.
   - 성공하면 `GuideModal`이 열려 제목·설명·난이도·예상 시간·핵심 개념·사전 준비·단계별 설명·코드/명령어 블록·팁/참고 링크 등을 카드형 섹션으로 보여 줍니다. 각 단계는 클릭으로 펼치고 복사 버튼으로 코드/명령어를 클립보드에 복사할 수 있으며, 모달 상단의 새로고침 버튼으로 캐시를 지우고 다시 생성할 수도 있습니다.
   - 캐시가 없으면 Netlify 함수에서 Gemini API와 Pub.dev/스크래퍼를 사용해 AI 가이드를 만들고, 성공 시 브라우저 로컬스토리지에 7일간 저장하여 반복 요청을 줄입니다. 실패시에는 이전 가이드나 fallback 정적 내용을 표시하며 디버그 정보와 해결 팁도 함께 제공합니다.

5. **커밋/배포**
   - 변경된 파일이 있으면 워크플로가 자동 커밋하고 푸시하여 최신 데이터가 저장소 및 배포 브랜치에 반영됩니다.
