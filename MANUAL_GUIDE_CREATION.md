# 정적 가이드 수동 생성 방법

이 문서는 data/guides/에 정적 가이드 JSON을 수동으로 추가하는 방법을 정리합니다.

---

## 1) 현재 상위 60개 패키지 목록 확인

    node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync("data/all-packages.json","utf-8"));data.packages.slice(0,60).forEach((p,i)=>console.log((i+1)+". "+p.name));'

## 2) 이미 생성된 가이드 확인

    ls data/guides

## 3) 상위 60개 중 누락된 패키지 확인

    node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync("data/all-packages.json","utf-8"));const top=data.packages.slice(0,60).map(p=>p.name);const existing=new Set(fs.readdirSync("data/guides").filter(f=>f.endsWith(".json")).map(f=>f.replace(/\.json$/,"")));const missing=top.filter(n=>!existing.has(n));console.log("missing:",missing.length);missing.forEach((n,i)=>console.log((i+1)+". "+n));'

## 4) 버전/좋아요 수 확인 (메타 채우기용)

    node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync("data/all-packages.json","utf-8"));const names=["local_auth","fluent_ui","flex_color_scheme","showcaseview","pdf","device_info_plus","introduction_screen","convex_bottom_bar","pull_to_refresh","flutter_riverpod","flutter_form_builder","package_info_plus","camera"];const map=new Map(data.packages.map(p=>[p.name,p]));names.forEach(n=>{const p=map.get(n);console.log(n, p?"version="+p.version+" likes="+p.likes:"not found");});'

---

## 5) 가이드 JSON 템플릿 복사

기준 파일: data/guides/shared_preferences.json

1) 해당 파일을 열어 구조를 그대로 복사합니다.
2) 아래 항목을 대상 패키지로 교체합니다.

필수 교체 항목:
- packageId
- title
- generatedAt
- packageVersion
- packageLikes
- overview (what/why/when/features)
- description
- difficulty
- estimatedTime
- prerequisites
- coreConcepts
- steps (5단계, 실제 코드 포함)
- apiReference
- commonErrors
- bestPractices
- tips

권장 추가 항목:
- relatedPackages
- references

---

## 6) 새 가이드 파일 생성

예시: local_auth 가이드 생성

    cat <<'EOF' > data/guides/local_auth.json
    {...공통 구조...}
    EOF

주의: JSON 문법 오류(쉼표, 따옴표)만 없으면 됩니다.

---

## 7) 생성 후 검증

    node -e 'const fs=require("fs");JSON.parse(fs.readFileSync("data/guides/local_auth.json","utf-8"));console.log("OK");'

---

## 8) 전체 누락 가이드 완료 체크

    node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync("data/all-packages.json","utf-8"));const top=data.packages.slice(0,60).map(p=>p.name);const existing=new Set(fs.readdirSync("data/guides").filter(f=>f.endsWith(".json")).map(f=>f.replace(/\.json$/,"")));const missing=top.filter(n=>!existing.has(n));console.log("missing:",missing.length);missing.forEach((n,i)=>console.log((i+1)+". "+n));'

---

## 9) 파일명 규칙

- 패키지명과 완전히 동일한 파일명 사용
  - 예: flutter_form_builder -> data/guides/flutter_form_builder.json
- 공백/대문자 금지

---

## 10) 추천 작성 순서

1. packageVersion/packageLikes 확인
2. overview 작성
3. steps 5단계 작성 (실제 동작 코드 포함)
4. coreConcepts/apiReference 채우기
5. commonErrors/bestPractices/tips 작성
6. references 추가

---

## 현재 남은 패키지 (상위 60 기준)

- local_auth
- fluent_ui
- flex_color_scheme
- showcaseview
- pdf
- device_info_plus
- introduction_screen
- convex_bottom_bar
- pull_to_refresh
- flutter_riverpod
- flutter_form_builder
- package_info_plus
- camera

