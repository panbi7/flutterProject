/**
 * 패키지 검색 및 가이드 생성 모듈
 * 3단계 검색: 100개 DB → 생성된 가이드 → pub.dev 실시간
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFullPackageInfo } from './pubdev-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

let genAI = null;
let model = null;

function initializeGemini() {
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    console.log('[SEARCH] ✅ Gemini API 초기화 완료');
  } else if (!GEMINI_API_KEY) {
    console.warn('[SEARCH] ⚠️ GEMINI_API_KEY가 설정되지 않았습니다.');
  }
}

/**
 * Step 1: top_flutter_packages.json에서 검색
 */
function searchInTop100(packageName) {
  try {
    const jsonPath = path.join(__dirname, '../../top_flutter_packages.json');

    if (!fs.existsSync(jsonPath)) {
      console.log('[SEARCH] top_flutter_packages.json 파일이 없습니다.');
      return null;
    }

    const packages = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const found = packages.find(
      (pkg) => pkg.packageName.toLowerCase() === packageName.toLowerCase()
    );

    if (found) {
      console.log(`[SEARCH] ✅ top_flutter_packages.json에서 "${packageName}" 발견`);
      return found;
    }

    console.log(`[SEARCH] top_flutter_packages.json에 "${packageName}" 없음`);
    return null;
  } catch (error) {
    console.error('[SEARCH] top_flutter_packages.json 읽기 실패:', error.message);
    return null;
  }
}

/**
 * Step 2: generated-guides/ 폴더에서 이미 생성된 가이드 검색
 */
function searchInGeneratedGuides(packageName) {
  try {
    const guidePath = path.join(__dirname, '../../generated-guides', `${packageName}.txt`);

    if (fs.existsSync(guidePath)) {
      const guide = fs.readFileSync(guidePath, 'utf-8');
      console.log(`[SEARCH] ✅ generated-guides에서 "${packageName}" 가이드 발견`);
      return {
        source: 'pregenerated',
        guide,
      };
    }

    console.log(`[SEARCH] generated-guides에 "${packageName}" 가이드 없음`);
    return null;
  } catch (error) {
    console.error('[SEARCH] generated-guides 읽기 실패:', error.message);
    return null;
  }
}

/**
 * Step 3: pub.dev에서 실시간 조회 + Gemini로 가이드 생성
 */
async function searchInPubDev(packageName) {
  try {
    console.log(`[SEARCH] pub.dev에서 "${packageName}" 조회 중...`);

    const packageInfo = await getFullPackageInfo(packageName);

    if (!packageInfo) {
      console.log(`[SEARCH] pub.dev에 "${packageName}" 패키지가 없습니다.`);
      return null;
    }

    console.log(`[SEARCH] ✅ pub.dev에서 "${packageName}" 발견`);

    // Gemini로 가이드 생성
    const guide = await generateGuideWithGemini(packageInfo);

    if (guide) {
      // 생성된 가이드를 파일로 저장 (다음번 사용 위해)
      saveGeneratedGuide(packageName, guide);
    }

    return {
      source: 'realtime',
      guide,
      packageInfo,
    };
  } catch (error) {
    console.error('[SEARCH] pub.dev 검색 실패:', error.message);
    return null;
  }
}

/**
 * Gemini로 Q&A 가이드 생성
 */
async function generateGuideWithGemini(packageInfo) {
  try {
    initializeGemini();

    if (!model) {
      console.warn('[SEARCH] Gemini API를 사용할 수 없습니다.');
      // Gemini 없이 기본 정보만 반환
      return createBasicGuide(packageInfo);
    }

    const prompt = createGuidePrompt(packageInfo);

    console.log(`[SEARCH] Gemini로 "${packageInfo.name}" 가이드 생성 중...`);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8000,
      },
    });

    const response = await result.response;
    const text = response.text();

    console.log(`[SEARCH] ✅ "${packageInfo.name}" 가이드 생성 완료`);

    return text;
  } catch (error) {
    console.error('[SEARCH] Gemini 가이드 생성 실패:', error.message);
    // 실패 시 기본 가이드 반환
    return createBasicGuide(packageInfo);
  }
}

/**
 * Gemini 프롬프트 생성
 */
function createGuidePrompt(packageInfo) {
  const { name, description, exampleCode, version } = packageInfo;

  return `당신은 Flutter/Dart 패키지 전문가입니다. 다음 패키지에 대한 챗봇용 Q&A 형식 구현 가이드를 작성해주세요.

패키지 정보:
- 이름: ${name}
- 버전: ${version}
- 설명: ${description}
${exampleCode ? `- 예제 코드:\n${exampleCode.substring(0, 1000)}` : ''}

요구사항:
1. 챗봇에서 사용자가 물어볼 만한 자연스러운 질문 형식 (Q:)
2. 친근하고 쉬운 말투로 답변 (A:)
3. 다음 질문들을 포함해주세요:
   - 패키지가 뭔지
   - 설치 방법
   - 기본 사용법
   - 주요 기능 3-5가지
   - 자주 발생하는 에러 2-3개
   - 실무 팁 2-3개

4. 코드 예시는 다음 형식으로:
   ────────────────────────────────────────────────────────────────────────
   코드 내용
   ────────────────────────────────────────────────────────────────────────

5. 마크다운 문법 사용 금지 (#, **, \`\`\`, >, - 등)
6. 총 길이는 약 300-400줄 정도

아래 형식을 정확히 따라주세요:

Q: ${name} 패키지가 뭐야?

A: (패키지 설명과 주요 용도)

   난이도: (초급/중급/고급)
   예상 학습 시간: (분)


Q: 설치는 어떻게 해?

A: (설치 방법 설명)

(이후 질문들 계속...)

지금 바로 시작해주세요:`;
}

/**
 * Gemini 없이 기본 가이드 생성
 */
function createBasicGuide(packageInfo) {
  const { name, description, exampleCode, version, url } = packageInfo;

  return `Q: ${name} 패키지가 뭐야?

A: ${description}

   버전: ${version}
   pub.dev: ${url}


Q: 설치는 어떻게 해?

A: pubspec.yaml 파일에 다음을 추가하세요:

   ────────────────────────────────────────────────────────────────────────
   dependencies:
     ${name}: ^${version}
   ────────────────────────────────────────────────────────────────────────

   그리고 터미널에서 실행:

   ────────────────────────────────────────────────────────────────────────
   flutter pub get
   ────────────────────────────────────────────────────────────────────────


Q: 기본 사용법은?

A: 먼저 import 하세요:

   ────────────────────────────────────────────────────────────────────────
   import 'package:${name}/${name}.dart';
   ────────────────────────────────────────────────────────────────────────

${exampleCode ? `\n   예제 코드:\n\n   ────────────────────────────────────────────────────────────────────────\n   ${exampleCode}\n   ────────────────────────────────────────────────────────────────────────` : ''}


더 자세한 정보는 pub.dev에서 확인하세요:
${url}
`;
}

/**
 * 생성된 가이드를 파일로 저장
 */
function saveGeneratedGuide(packageName, guide) {
  try {
    const outputDir = path.join(__dirname, '../../generated-guides');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, `${packageName}.txt`);
    fs.writeFileSync(filePath, guide, 'utf-8');

    console.log(`[SEARCH] 💾 "${packageName}" 가이드 저장 완료: ${filePath}`);
  } catch (error) {
    console.error('[SEARCH] 가이드 저장 실패:', error.message);
  }
}

/**
 * 메인 검색 함수: 3단계 검색 실행
 * @param {string} packageName - 패키지 이름
 * @returns {Promise<Object|null>} 검색 결과
 */
export async function searchPackage(packageName) {
  console.log(`\n[SEARCH] 🔍 "${packageName}" 패키지 검색 시작`);

  // Step 1: top_flutter_packages.json 검색
  const top100Result = searchInTop100(packageName);

  // Step 2: generated-guides 검색
  const generatedGuide = searchInGeneratedGuides(packageName);

  if (generatedGuide) {
    return {
      packageName,
      source: 'pregenerated',
      guide: generatedGuide.guide,
      packageInfo: top100Result, // top100에 있으면 정보도 포함
    };
  }

  // Step 3: pub.dev 실시간 검색
  const pubdevResult = await searchInPubDev(packageName);

  if (pubdevResult) {
    return {
      packageName,
      source: 'realtime',
      guide: pubdevResult.guide,
      packageInfo: pubdevResult.packageInfo,
    };
  }

  console.log(`[SEARCH] ❌ "${packageName}" 패키지를 찾을 수 없습니다.`);
  return null;
}
