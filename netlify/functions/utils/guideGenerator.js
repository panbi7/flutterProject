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

        // 2. Gemini 프롬프트 구성
        const prompt = `
당신은 Flutter 전문가입니다. 다음 Flutter 패키지에 대한 심층적인 구현 가이드를 작성해주세요.

패키지 정보:
- 이름: ${packageInfo.name}
- 최신 버전: ${packageInfo.version}
- 설명: ${packageInfo.description}
- 홈페이지: ${packageInfo.homepage || 'N/A'}

요구사항:
1. 답변은 반드시 한국어로 작성하세요.
2. 마크다운 형식을 사용하지 말고, 평문(Plain Text)으로만 작성하세요.
3. 다음 섹션을 반드시 포함하세요:
   - [개요]: 패키지의 용도와 장점
   - [설치]: pubspec.yaml 설정 방법
   - [기본 사용법]: 간단하고 명확한 코드 예제 (설명 포함)
   - [주요 기능]: 패키지가 제공하는 핵심 기능 2-3가지 상세 설명
   - [주의사항/에러]: 자주 발생하는 실수나 에러 해결법
   - [베스트 프랙티스]: 성능이나 유지보수 측면의 권장 사항

가이드를 작성해주세요:
`;

        // 3. Gemini로 가이드 생성
        const guideText = await callGeminiForGuide(prompt);

        if (!guideText) {
            throw new Error('Gemini 가이드 생성 실패');
        }

        // 4. 결과 반환 (구조화된 형식이 아닌 plainText로 반환하여 GuideModal에서 처리)
        return {
            title: `${packageInfo.name} 구현 가이드`,
            description: packageInfo.description,
            plainText: guideText,
            source: 'generated',
            packageInfo: {
                version: packageInfo.version,
                homepage: packageInfo.homepage
            }
        };
    } catch (error) {
        console.error(`[Guide Generator] 에러 (${packageName}):`, error.message);
        throw error;
    }
}
