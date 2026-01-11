import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// __dirname 설정 (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Gemini API 초기화
let genAI = null;
let model = null;

function initializeGemini() {
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    console.log('✅ Gemini API 초기화 완료');
  } else if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    console.error('   backend/.env 파일에 GEMINI_API_KEY를 추가하세요.');
    process.exit(1);
  }
}

// 구현 가이드 생성 프롬프트
function createGuidePrompt(packageInfo) {
  const { packageName, description, exampleCode, tags } = packageInfo;

  return `당신은 Flutter/Dart 패키지 전문가입니다. 다음 패키지에 대한 챗봇용 Q&A 형식 구현 가이드를 작성해주세요.

패키지 정보:
- 이름: ${packageName}
- 설명: ${description}
- 태그: ${tags.join(', ')}
${exampleCode ? `- 예제 코드:\n${exampleCode.substring(0, 500)}...` : ''}

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
6. 총 길이는 약 400-500줄 정도

아래 형식을 정확히 따라주세요:

Q: ${packageName} 패키지가 뭐야?

A: (패키지 설명과 주요 용도)

   난이도: (초급/중급/고급)
   예상 학습 시간: (분)


Q: 설치는 어떻게 해?

A: (설치 방법 설명)

(이후 질문들 계속...)

지금 바로 시작해주세요:`;
}

// Gemini API 호출하여 가이드 생성
async function generateGuide(packageInfo) {
  try {
    const prompt = createGuidePrompt(packageInfo);

    console.log(`\n🤖 ${packageInfo.packageName} 가이드 생성 중...`);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8000,
      },
    });

    const response = await result.response;
    const text = response.text();

    console.log(`✅ ${packageInfo.packageName} 가이드 생성 완료 (${text.length} 글자)`);

    return text;
  } catch (error) {
    console.error(`❌ ${packageInfo.packageName} 가이드 생성 실패:`, error.message);
    return null;
  }
}

// 모든 패키지의 가이드를 하나의 파일로 합치기
function combineGuides(guides) {
  const header = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Flutter 패키지 구현 가이드 모음 - 챗봇 Q&A
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

총 ${guides.length}개 패키지 가이드

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  const separator = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  const footer = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
마지막 업데이트: ${new Date().toISOString().split('T')[0]}
총 ${guides.length}개 패키지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return header + guides.join(separator) + footer;
}

// 메인 실행 함수
async function main() {
  console.log('🚀 Flutter 패키지 가이드 자동 생성 시작\n');

  // Gemini API 초기화
  initializeGemini();

  // JSON 파일 읽기
  const jsonPath = path.join(__dirname, 'top_flutter_packages.json');
  console.log(`📂 패키지 정보 읽는 중: ${jsonPath}`);

  const packagesData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`✅ 총 ${packagesData.length}개 패키지 로드 완료\n`);

  // 생성할 패키지 개수 설정 (테스트용으로 먼저 3개만)
  const LIMIT = parseInt(process.argv[2]) || 3;
  const packagesToProcess = packagesData.slice(0, LIMIT);

  console.log(`📝 ${packagesToProcess.length}개 패키지 가이드 생성 예정\n`);
  console.log('패키지 목록:');
  packagesToProcess.forEach((pkg, idx) => {
    console.log(`  ${idx + 1}. ${pkg.packageName}`);
  });
  console.log('');

  // 각 패키지의 가이드 생성
  const guides = [];

  for (let i = 0; i < packagesToProcess.length; i++) {
    const packageInfo = packagesToProcess[i];
    const guide = await generateGuide(packageInfo);

    if (guide) {
      guides.push(guide);

      // 개별 파일로도 저장
      const outputDir = path.join(__dirname, 'generated-guides');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const individualFilePath = path.join(outputDir, `${packageInfo.packageName}.txt`);
      fs.writeFileSync(individualFilePath, guide, 'utf-8');
      console.log(`💾 개별 파일 저장: ${individualFilePath}`);
    }

    // API 요청 제한 방지 (요청 간 1초 대기)
    if (i < packagesToProcess.length - 1) {
      console.log('⏳ 1초 대기 중...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 모든 가이드를 하나의 파일로 합치기
  if (guides.length > 0) {
    const combinedGuide = combineGuides(guides);
    const outputPath = path.join(__dirname, 'all-package-guides.txt');
    fs.writeFileSync(outputPath, combinedGuide, 'utf-8');

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ 완료! 총 ${guides.length}개 가이드 생성`);
    console.log(`📄 통합 파일: ${outputPath}`);
    console.log(`📁 개별 파일: ${path.join(__dirname, 'generated-guides')}/`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else {
    console.log('\n❌ 생성된 가이드가 없습니다.');
  }
}

// 실행
main().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
