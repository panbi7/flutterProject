# Flutter 패키지 가이드 자동 생성기

Gemini AI를 사용해서 Flutter 패키지 구현 가이드를 자동으로 생성하는 도구입니다.

## 사용 방법

### 1. 필수 패키지 설치

```bash
npm install dotenv
```

### 2. Gemini API 키 설정

`backend/.env` 파일에 Gemini API 키가 있는지 확인하세요:

```
GEMINI_API_KEY=your-api-key-here
```

### 3. 스크립트 실행

**테스트 (3개 패키지만):**
```bash
node generate-guides.js
```

**5개 패키지:**
```bash
node generate-guides.js 5
```

**10개 패키지:**
```bash
node generate-guides.js 10
```

**전체 50개 패키지:**
```bash
node generate-guides.js 50
```

## 결과물

### 생성되는 파일

1. **통합 파일**: `all-package-guides.txt`
   - 모든 패키지 가이드를 하나로 합친 파일
   - 챗봇 학습 데이터로 바로 사용 가능

2. **개별 파일**: `generated-guides/패키지이름.txt`
   - 각 패키지별로 따로 저장된 파일
   - 필요한 패키지만 선택적으로 사용 가능

### 가이드 형식

각 가이드는 챗봇용 Q&A 형식으로 생성됩니다:

```
Q: http 패키지가 뭐야?

A: http 패키지는 Dart/Flutter에서 HTTP 요청을 간편하게 처리할 수 있는...

Q: 설치는 어떻게 해?

A: pubspec.yaml 파일에 추가하면 됩니다...
```

## 주요 기능

- ✅ Gemini AI로 자동 가이드 생성
- ✅ 챗봇 학습에 최적화된 Q&A 형식
- ✅ 코드 예시 포함
- ✅ 친근한 말투 사용
- ✅ 50개 패키지 일괄 처리 가능
- ✅ 개별/통합 파일 모두 제공
- ✅ API 요청 제한 방지 (1초 간격)

## 생성되는 내용

각 패키지마다 다음 내용이 포함됩니다:

1. 패키지 소개
2. 설치 방법
3. 기본 사용법
4. 주요 기능 3-5가지
5. 자주 발생하는 에러 해결법
6. 실무 팁
7. 코드 예시

## 예상 소요 시간

- 3개 패키지: 약 1분
- 10개 패키지: 약 3분
- 50개 패키지: 약 15분

## 주의사항

1. **API 비용**: Gemini API를 사용하므로 비용이 발생할 수 있습니다
2. **요청 제한**: 각 요청 사이에 1초씩 대기합니다
3. **네트워크**: 안정적인 인터넷 연결이 필요합니다

## 문제 해결

### "GEMINI_API_KEY가 설정되지 않았습니다" 에러

`backend/.env` 파일을 확인하고 API 키를 추가하세요:
```
GEMINI_API_KEY=your-actual-api-key
```

### 가이드가 생성되지 않음

1. 인터넷 연결 확인
2. Gemini API 키가 유효한지 확인
3. API 할당량이 남아있는지 확인

### 생성 중간에 멈춤

Ctrl+C로 중단하고 다시 실행하세요. 이미 생성된 개별 파일들은 `generated-guides/` 폴더에 저장되어 있습니다.

## 커스터마이징

`generate-guides.js` 파일에서 다음을 수정할 수 있습니다:

- **프롬프트**: `createGuidePrompt()` 함수
- **가이드 형식**: 프롬프트 내 요구사항 수정
- **대기 시간**: `setTimeout` 값 조정 (현재 1000ms)
- **출력 길이**: `maxOutputTokens` 값 조정 (현재 8000)

## 라이선스

MIT
