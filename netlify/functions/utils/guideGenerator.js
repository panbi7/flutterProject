import { getPackageInfo } from './pubdevApi.js';
import { callGeminiForGuide } from './gemini.js';
import { getLocalPackageInfo } from './localPackageInfo.js';

/**
 * pub.dev 정보를 바탕으로 Gemini를 사용하여 실시간 구현 가이드를 생성합니다.
 * @param {string} packageName 
 * @returns {Promise<Object|null>}
 */
export async function generateGuideFromPubDev(packageName) {
  try {
    // 1. pub.dev 및 로컬 지식 베이스에서 패키지 정보 가져오기
    const [pubInfo, localInfo] = await Promise.all([
      getPackageInfo(packageName),
      getLocalPackageInfo(packageName)
    ]);

    if (!pubInfo) {
      console.warn(`[Guide Generator] 패키지를 찾을 수 없어 가이드 생성을 중단합니다: ${packageName}`);
      return null;
    }

    // 지식 베이스 정보 결합 (로컬 데이터 우선 순위)
    const finalDescription = localInfo?.description || pubInfo.description;
    const exampleSnippet = localInfo?.exampleCode ? `공식 예제 코드:\n${localInfo.exampleCode}` : '';

    // 2. Gemini 프롬프트 구성 (구조화된 JSON 요청 + RAG 컨텍스트)
    const prompt = `
당신은 세계 최고의 Flutter 전문가입니다. 제공된 '공식 예제 코드'를 기반으로, 해당 패키지를 실무에 바로 적용할 수 있는 **완벽한 구현 가이드**를 작성하는 것이 임무입니다.

품질 기준:
- 'firebase_auth' 패키지 가이드 수준으로 매우 상세하고 구조적이어야 합니다.
- 단순히 코드를 보여주는 것을 넘어, 왜 이 코드가 필요한지, 어떤 설정이 선행되어야 하는지 친절하게 설명하세요.
- 모든 텍스트(제목, 설명, 팁 등)는 **한국어**로 작성하세요.

패키지 정보:
- 이름: ${pubInfo.name}
- 버전: ${pubInfo.version}
- 설명: ${finalDescription}
${exampleSnippet}

요구사항:
1. 반드시 다음 JSON 구조를 지켜서 응답하세요. (구조가 틀리면 시스템이 작동하지 않습니다.)
2. 마크다운 기호(\`\`\`) 없이 순수 JSON 객체만 반환하세요.
3. [중요] '공식 예제 코드'를 심층 분석하여, 실제 작동 가능하고 Flutter의 최신 모범 사례(Clean Architecture, Null Safety 등)를 반영한 코드를 포함하세요.
4. 초보자도 따라 할 수 있도록 단계를 1번부터 상세히 나누되, 코드가 너무 길어질 경우 핵심 로직 위주로 작성하여 응답이 중간에 끊기지 않도록 하세요.
5. [중고급자 배려] 가이드의 깊이는 유지하되, 반복되는 보일러플레이트 코드는 생략하거나 주석 처리하여 가독성을 높이세요.

JSON Schema:
{
  "title": "${pubInfo.name} 구현 가이드",
  "description": "패키지의 핵심 가치를 설명하는 짧고 명확한 요약",
  "difficulty": "초급/중급/고급 중 선택",
  "estimatedTime": "소요 예상 시간 (예: 20-30분)",
  "prerequisites": ["사전 설치 필요 항목 (예: CocoaPods, API Key)"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "단계 제목",
      "description": "이 단계에서 무엇을 하는지 상세 설명",
      "substeps": ["작은 수행 단위 1", "작은 수행 단위 2"],
      "code": {
        "language": "dart",
        "filename": "lib/main.dart (예시)",
        "content": "실제 코드 내용"
      },
      "command": "터미널 명령어 (필요 시)",
      "commands": ["명령어1", "명령어2"],
      "note": "중요한 주의사항이나 팁",
      "explanation": "코드에 대한 심층 해설"
    }
  ],
  "commonErrors": [
    { "error": "에러 상황", "solution": "해결 방법", "link": "참고 URL (선택)" }
  ],
  "tips": ["전문가용 실무 팁 1", "성능 최적화 팁 2"],
  "nextSteps": [
    { "title": "다음 단계 제목", "description": "다음에 무엇을 공부하면 좋은지", "packageId": "연관 패키지ID (선택)" }
  ],
  "references": [
    { "title": "공식 문서", "url": "https://pub.dev/packages/${pubInfo.name}" }
  ]
}

이제 ${pubInfo.name}에 대한 완벽한 가이드를 위 JSON 형식으로 작성해주세요.
`;

    // 3. Gemini로 가이드 생성
    const responseText = await callGeminiForGuide(prompt);

    if (!responseText) {
      throw new Error('Gemini 가이드 생성 실패');
    }

    try {
      // JSON 응답에서 불필요한 마크다운 기호(```json ... ```) 제거 후 파싱
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const structuredGuide = JSON.parse(cleanJson);

      return {
        ...structuredGuide,
        source: 'generated'
      };
    } catch (parseError) {
      console.warn(`[Guide Generator] JSON 파싱 실패, plainText로 대체:`, parseError.message);
      // 파싱 실패 시 예비용으로 plainText 형태로라도 반환 (GuideModal에서 처리 가능)
      return {
        title: `${pubInfo.name} 구현 가이드`,
        description: pubInfo.description,
        plainText: responseText,
        source: 'generated'
      };
    }
  } catch (error) {
    console.error(`[Guide Generator] 에러 (${packageName}):`, error.message);
    throw error;
  }
}
