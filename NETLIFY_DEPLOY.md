# Netlify 배포 가이드

이 프로젝트를 Netlify에 배포하는 방법입니다.

## 사전 준비

1. **Gemini API 키 발급**
   - https://makersuite.google.com/app/apikey 에서 API 키 발급
   - 키를 복사해두기

2. **GitHub 저장소 생성** (선택사항, 권장)
   - 프로젝트를 GitHub에 푸시

## Netlify 배포 단계

### 방법 1: GitHub 연동 배포 (권장)

1. **Netlify 로그인**
   - https://app.netlify.com/ 접속
   - GitHub 계정으로 로그인

2. **새 사이트 추가**
   - "Add new site" → "Import an existing project" 클릭
   - GitHub 선택
   - 이 저장소 선택

3. **빌드 설정**
   자동으로 다음과 같이 설정됩니다:
   ```
   Build command: npm run build
   Publish directory: dist
   ```

4. **환경 변수 설정** (중요!)
   - "Site settings" → "Environment variables" 이동
   - 다음 변수 추가:
     ```
     GEMINI_API_KEY = your-gemini-api-key-here
     GEMINI_MODEL = gemini-1.5-flash
     ```

5. **배포**
   - "Deploy site" 클릭
   - 빌드가 완료되면 자동으로 배포됩니다

### 방법 2: Netlify CLI로 배포

1. **Netlify CLI 설치**
   ```bash
   npm install -g netlify-cli
   ```

2. **로그인**
   ```bash
   netlify login
   ```

3. **프로젝트 초기화**
   ```bash
   netlify init
   ```

4. **환경 변수 설정**
   ```bash
   netlify env:set GEMINI_API_KEY "your-api-key"
   netlify env:set GEMINI_MODEL "gemini-1.5-flash"
   ```

5. **배포**
   ```bash
   netlify deploy --prod
   ```

## 배포 후 확인

1. **API 테스트**
   Netlify가 제공하는 URL (예: `https://your-app.netlify.app`)로 접속

2. **Function 로그 확인**
   - Netlify Dashboard → Functions 탭
   - `intent` 함수 클릭
   - Logs에서 오류 확인

3. **테스트 요청**
   ```bash
   curl -X POST https://your-app.netlify.app/api/intent \
     -H "Content-Type: application/json" \
     -d '{"message": "카카오톡으로 로그인하고 싶어"}'
   ```

## 주의사항

1. **환경 변수는 필수입니다**
   - `GEMINI_API_KEY`가 없으면 fallback으로 작동
   - 하지만 AI 추천이 안 되므로 반드시 설정 필요

2. **무료 티어 제한**
   - Netlify Functions: 월 125,000 요청, 100시간 실행시간
   - 초과 시 과금 발생

3. **콜드 스타트**
   - 처음 요청은 느릴 수 있음 (2-3초)
   - 이후 요청은 빠름

## 트러블슈팅

### 문제: Function이 404 에러
**해결:** `netlify.toml` 파일이 프로젝트 루트에 있는지 확인

### 문제: Gemini API 오류
**해결:**
- Netlify Dashboard에서 환경 변수 확인
- API 키가 올바른지 확인
- Gemini API 할당량 확인

### 문제: CORS 에러
**해결:** 이미 Function에 CORS 헤더가 포함되어 있으므로 문제 없음

## 비용

- **Netlify**: 무료 티어로 충분 (소규모 앱)
- **Gemini API**: 무료 티어 사용 (제한적)
  - 분당 15 요청
  - 하루 1,500 요청

## 자동 배포

GitHub와 연동한 경우:
- `main` 브랜치에 푸시하면 자동으로 배포
- Pull Request를 만들면 Preview 배포 생성

## 더 알아보기

- Netlify Functions 문서: https://docs.netlify.com/functions/overview/
- Gemini API 문서: https://ai.google.dev/docs
