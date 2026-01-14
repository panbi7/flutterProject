import { getPackageInfo } from './pubdevApi.js';
import { callGeminiForGuide } from './gemini.js';

/**
 * pub.dev 정보를 바탕으로 Gemini를 사용하여 실시간 구현 가이드를 생성합니다.
 * @param {string} packageName 
 * @returns {Promise<Object|null>}
 */
export async function generateGuideFromPubDev(packageName) {
    try {
        // 1. pub.dev에서 패키지 정보 가져오기
        const packageInfo = await getPackageInfo(packageName);
        if (!packageInfo) {
            console.warn(`[Guide Generator] 패키지 정보를 찾을 수 없어 가이드 생성을 중단합니다: ${packageName}`);
            return null;
        }

        // 2. Gemini 프롬프트 구성 (구조화된 JSON 요청)
        const prompt = `
당신은 Flutter 전문가입니다. 다음 Flutter 패키지에 대한 심층적인 구현 가이드를 반드시 JSON 형식으로 작성해주세요.

패키지 정보:
- 이름: ${packageInfo.name}
- 버전: ${packageInfo.version}
- 설명: ${packageInfo.description}

요구사항:
1. 반드시 다음 JSON 구조를 지켜서 응답하세요.
2. 모든 설명과 텍스트는 한국어로 작성하세요.
3. [중요] 마크다운 형식을 사용하지 말고, 순수 JSON 객체만 반환하세요.
4. 예제 코드는 실제 작동 가능한 최신 문법(Null Safety 등)을 반영하세요.

JSON Schema:
{
  "title": "${packageInfo.name} 구현 가이드",
  "description": "패키지에 대한 짧고 명확한 설명",
  "difficulty": "초급/중급/고급 중 선택",
  "estimatedTime": "소요 예상 시간 (예: 20-30분)",
  "prerequisites": ["사전 설치 필요 항목", "설정 필요 사항"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "단계 제목",
      "description": "해당 단계에 대한 설명",
      "substeps": ["상세 수행 항목 1", "상세 수행 항목 2"],
      "code": {
        "language": "dart or yaml",
        "filename": "파일명 (생략 가능)",
        "content": "실제 코드 내용"
      },
      "command": "터미널 명령어가 필요한 경우",
      "note": "추가 팁이나 주의사항"
    }
  ],
  "commonErrors": [
    { "error": "에러 메시지나 상황", "solution": "해결 방법" }
  ],
  "tips": ["전문가 팁 1", "팁 2"],
  "references": [
    { "title": "공식 문서", "url": "https://pub.dev/packages/${packageInfo.name}" }
  ]
}

이제 ${packageInfo.name}에 대한 가이드를 위 JSON 형식으로 작성해주세요.
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
                title: `${packageInfo.name} 구현 가이드`,
                description: packageInfo.description,
                plainText: responseText,
                source: 'generated'
            };
        }
    } catch (error) {
        console.error(`[Guide Generator] 에러 (${packageName}):`, error.message);
        throw error;
    }
}
