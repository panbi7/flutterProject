import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function createPrompt(packageInfo, exampleCode) {
  const { name, version, description } = packageInfo.latest;
  const exampleSnippet = exampleCode ? `공식 예제 코드:\n\
\
```dart\
${exampleCode}\
```\
` : '공식 예제 코드를 찾을 수 없습니다.';

  return `
당신은 Flutter 전문가입니다. 다음 정보를 바탕으로 '${name}' 패키지의 실용적인 구현 가이드를 작성해주세요.

- 패키지: ${name} (v${version})
- 설명: ${description}
${exampleSnippet}

요구사항:
1. 반드시 다음 JSON 구조를 지켜서 순수 JSON 객체만 반환하세요 (마크다운 제외).
2. 초보자도 따라 할 수 있도록 단계별로 상세히 설명하고, 코드 예시를 포함하세요.

JSON Schema:
{
  "title": "${name} 구현 가이드",
  "description": "패키지의 핵심 가치를 요약합니다.",
  "difficulty": "초급/중급/고급",
  "steps": [
    {
      "stepNumber": 1,
      "title": "1단계: 의존성 추가",
      "description": "pubspec.yaml 파일에 패키지를 추가하는 방법입니다.",
      "code": { "language": "yaml", "content": "${name}: ^${version}" }
    },
    {
      "stepNumber": 2,
      "title": "2단계: 기본 설정 (필요 시)",
      "description": "Android, iOS 또는 Flutter 프로젝트의 초기 설정에 대해 설명합니다.",
      "code": { "language": "dart", "content": "..." }
    }
  ],
  "tips": ["실무에서 유용한 팁"]
}

이제 ${name} 패키지에 대한 완벽한 가이드를 위 JSON 형식으로 작성해주세요.
`;
}

async function generate(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  // AI 응답에서 JSON 부분만 추출
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON.');
  
  const jsonString = (jsonMatch[1] || jsonMatch[2]).trim();
  return JSON.parse(jsonString);
}

export const aiService = {
  createPrompt,
  generate,
};
