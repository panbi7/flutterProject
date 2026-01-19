import { createLogger } from '../utils/logger.js';
import { generateGuideWithGemini } from '../adapters/gemini.adapter.js';
import { getPackageInfo } from './packageInfo.service.js';
import { getCachedGuide, setCachedGuide } from './cache.service.js';
import { safeJsonParse } from '../utils/validator.js';

const logger = createLogger('GUIDE_GENERATOR_SERVICE');

/**
 * 가이드 생성 프롬프트 생성
 */
function createGuidePrompt(packageInfo) {
    const { name, version, description, exampleCode } = packageInfo;

    const exampleSnippet = exampleCode
        ? `공식 예제 코드 (pub.dev Example):\n${exampleCode.substring(0, 1000)}${exampleCode.length > 1000 ? '...' : ''}`
        : '';

    return `
당신은 세계 최고의 Flutter 전문가입니다. 제공된 '공식 예제 코드'를 기반으로, 해당 패키지를 실무에 바로 적용할 수 있는 **완벽한 구현 가이드**를 작성하는 것이 임무입니다.

품질 기준:
- 'firebase_auth' 패키지 가이드 수준으로 매우 상세하고 구조적이어야 합니다.
- 단순히 코드를 보여주는 것을 넘어, 왜 이 코드가 필요한지, 어떤 설정이 선행되어야 하는지 친절하게 설명하세요.
- 모든 텍스트(제목, 설명, 팁 등)는 **한국어**로 작성하세요.

패키지 정보:
- 이름: ${name}
- 버전: ${version}
- 설명: ${description}
${exampleSnippet}

요구사항:
1. 반드시 다음 JSON 구조를 지켜서 응답하세요. (구조가 틀리면 시스템이 작동하지 않습니다.)
2. 마크다운 기호(\`\`\`) 없이 순수 JSON 객체만 반환하세요.
3. [중요] '공식 예제 코드'를 심층 분석하여, 실제 작동 가능하고 Flutter의 최신 모범 사례(Clean Architecture, Null Safety 등)를 반영한 코드를 포함하세요.
4. 초보자도 따라 할 수 있도록 단계를 1번부터 상세히 나누되, 코드가 너무 길어질 경우 핵심 로직 위주로 작성하여 응답이 중간에 끊기지 않도록 하세요.
5. [중고급자 배려] 가이드의 깊이는 유지하되, 반복되는 보일러플레이트 코드는 생략하거나 주석 처리하여 가독성을 높이세요.

JSON Schema:
{
  "title": "${name} 구현 가이드",
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
    { "title": "공식 문서", "url": "https://pub.dev/packages/${name}" }
  ]
}

이제 ${name}에 대한 완벽한 가이드를 위 JSON 형식으로 작성해주세요.
`;
}

/**
 * AI 가이드 생성
 * @param {string} packageName
 * @returns {Promise<Object>}
 */
export async function generateGuide(packageName) {
    logger.info('Generating guide', { packageName });

    // 1. 패키지 정보 수집
    const packageInfo = await getPackageInfo(packageName);

    // 2. 캐시 확인 (버전별)
    const cached = await getCachedGuide(packageName, packageInfo.version);
    if (cached) {
        logger.info('Guide from cache', { packageName, version: packageInfo.version });
        return cached;
    }

    // 3. Gemini로 가이드 생성
    const prompt = createGuidePrompt(packageInfo);
    const responseText = await generateGuideWithGemini(prompt);

    // 4. JSON 파싱
    let guide;
    try {
        // JSON 응답에서 마크다운 기호 제거
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        guide = safeJsonParse(cleanJson);

        if (!guide) {
            throw new Error('Failed to parse JSON response');
        }

        guide.source = 'generated';
        guide.generatedAt = new Date().toISOString();
        guide.packageVersion = packageInfo.version;
    } catch (parseError) {
        logger.warn('JSON parsing failed, returning plainText', {
            packageName,
            error: parseError.message,
        });

        // 파싱 실패 시 plainText로 반환
        guide = {
            title: `${packageName} 구현 가이드`,
            description: packageInfo.description,
            plainText: responseText,
            source: 'generated',
            generatedAt: new Date().toISOString(),
            packageVersion: packageInfo.version,
        };
    }

    // 5. 캐시에 저장
    await setCachedGuide(packageName, packageInfo.version, guide);

    logger.info('Guide generated and cached', {
        packageName,
        version: packageInfo.version,
    });

    return guide;
}

/**
 * 여러 패키지 가이드 일괄 생성
 * @param {Array<string>} packageNames
 * @returns {Promise<Array<Object>>}
 */
export async function generateMultipleGuides(packageNames) {
    logger.info('Generating multiple guides', { count: packageNames.length });

    const results = [];

    for (const packageName of packageNames) {
        try {
            const guide = await generateGuide(packageName);
            results.push({ packageName, guide, success: true });

            // Rate limit 방지
            await sleep(1000);
        } catch (error) {
            logger.error('Failed to generate guide', {
                packageName,
                error: error.message,
            });
            results.push({ packageName, error: error.message, success: false });
        }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info('Multiple guides generation completed', {
        total: packageNames.length,
        success: successCount,
        failed: packageNames.length - successCount,
    });

    return results;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
