#!/usr/bin/env node

/**
 * 모든 패키지에 대해 고품질 가이드 JSON을 미리 생성하는 스크립트
 *
 * 사용법:
 *   node scripts/generate-guides.js              # 전체 생성 (가이드 없는 패키지만)
 *   node scripts/generate-guides.js --force      # 전체 재생성
 *   node scripts/generate-guides.js --limit 100  # 상위 100개만
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 설정
const CONFIG = {
    PACKAGES_FILE: path.join(ROOT_DIR, 'data', 'packages-lite.json'),
    EXAMPLES_DIR: path.join(ROOT_DIR, 'data', 'examples'),
    GUIDES_DIR: path.join(ROOT_DIR, 'netlify', 'functions', 'data', 'examples'),
    PROGRESS_FILE: path.join(ROOT_DIR, 'data', 'guide-generation-progress.json'),

    // API 설정
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: 'gemini-2.0-flash',

    // Rate Limit (무료 티어: 분당 15회, 일일 1500회)
    DELAY_BETWEEN_REQUESTS: 5000,  // 5초 (무료 티어 제한 고려)
    BATCH_SIZE: 10,
    DELAY_BETWEEN_BATCHES: 30000,  // 30초
    QUOTA_WAIT_TIME: 60000,        // 할당량 초과 시 60초 대기
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Gemini 초기화
let genAI = null;
let model = null;

function initGemini() {
    if (!CONFIG.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY 환경변수가 필요합니다.');
        console.log('   export GEMINI_API_KEY="your-api-key"');
        process.exit(1);
    }
    genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: CONFIG.GEMINI_MODEL });
}

// 진행 상황 저장/로드
function loadProgress() {
    try {
        if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
        }
    } catch (e) {}
    return { completed: [], failed: [], lastIndex: 0 };
}

function saveProgress(progress) {
    fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// 가이드 생성 프롬프트
function buildPrompt(pkg, exampleCode) {
    const exampleSnippet = exampleCode
        ? `\n\n공식 예제 코드:\n\`\`\`dart\n${exampleCode.substring(0, 3000)}\n\`\`\``
        : '';

    return `당신은 Flutter 전문가입니다. 아래 패키지에 대한 **완벽한 구현 가이드**를 JSON 형식으로 작성하세요.

## 패키지 정보
- 이름: ${pkg.name}
- 버전: ${pkg.version}
- 설명: ${pkg.description}
- 플랫폼: ${(pkg.platforms || []).join(', ')}${exampleSnippet}

## 요구사항
1. 모든 텍스트는 **한국어**로 작성
2. 마크다운 기호 없이 순수 JSON만 반환
3. 실제 작동하는 코드 포함
4. 초보자도 따라할 수 있는 단계별 설명

## JSON 형식 (정확히 이 구조를 따르세요)
{
  "packageId": "${pkg.name}",
  "packageName": "${pkg.name}",
  "title": "${pkg.name} 구현 가이드",
  "description": "이 패키지의 핵심 기능과 용도를 1-2문장으로 설명",
  "difficulty": "초급/중급/고급 중 선택",
  "estimatedTime": "예상 소요 시간 (예: 15-20분)",
  "prerequisites": ["사전 준비 사항 1", "사전 준비 사항 2"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "패키지 설치",
      "description": "단계 설명",
      "code": {
        "language": "yaml",
        "filename": "pubspec.yaml",
        "content": "dependencies:\\n  ${pkg.name}: ^${pkg.version}"
      },
      "command": "flutter pub get",
      "note": "참고 사항 (선택)"
    },
    {
      "stepNumber": 2,
      "title": "기본 사용법",
      "description": "핵심 기능 구현 방법",
      "code": {
        "language": "dart",
        "filename": "lib/main.dart",
        "content": "실제 작동하는 코드"
      },
      "explanation": "코드 설명"
    }
  ],
  "commonErrors": [
    {
      "error": "자주 발생하는 에러",
      "solution": "해결 방법"
    }
  ],
  "tips": ["실무 팁 1", "실무 팁 2", "성능 최적화 팁"],
  "nextSteps": [
    {
      "title": "다음 단계",
      "description": "추가 학습 추천",
      "packageId": "관련 패키지 (선택)"
    }
  ],
  "references": [
    {
      "title": "공식 문서",
      "url": "https://pub.dev/packages/${pkg.name}"
    }
  ]
}

위 JSON 형식으로 ${pkg.name} 가이드를 작성하세요. 단계는 4-6개가 적당합니다.`;
}

// Gemini API 호출 (재시도 로직 포함)
async function generateGuide(pkg, exampleCode, retryCount = 0) {
    const prompt = buildPrompt(pkg, exampleCode);

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
            },
        });

        const text = result.response.text();

        // JSON 추출 및 파싱
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        // 429 할당량 초과 시 대기 후 재시도
        if (error.message.includes('429') || error.message.includes('quota')) {
            if (retryCount < 3) {
                console.log(`\n   ⏳ 할당량 초과 - ${CONFIG.QUOTA_WAIT_TIME / 1000}초 대기 후 재시도...`);
                await sleep(CONFIG.QUOTA_WAIT_TIME);
                return generateGuide(pkg, exampleCode, retryCount + 1);
            }
        }
        throw new Error(`Gemini API 오류: ${error.message}`);
    }
}

// 메인 함수
async function main() {
    const args = process.argv.slice(2);
    const forceRegenerate = args.includes('--force');
    const limitIndex = args.indexOf('--limit');
    const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : Infinity;

    console.log('\n========================================');
    console.log('  Flutter Package Guide Generator');
    console.log('========================================\n');

    initGemini();

    // 패키지 데이터 로드
    console.log('📦 패키지 데이터 로딩...');
    const packagesData = JSON.parse(fs.readFileSync(CONFIG.PACKAGES_FILE, 'utf-8'));
    const packages = packagesData.packages.slice(0, limit);
    console.log(`   ${packages.length}개 패키지 로드됨\n`);

    // 가이드 디렉토리 생성
    fs.mkdirSync(CONFIG.GUIDES_DIR, { recursive: true });

    // 기존 가이드 목록
    const existingGuides = new Set(
        fs.readdirSync(CONFIG.GUIDES_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''))
    );

    // 진행 상황 로드
    const progress = loadProgress();

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];

        // 이미 가이드가 있으면 건너뛰기 (--force가 아니면)
        if (!forceRegenerate && existingGuides.has(pkg.name)) {
            skipped++;
            continue;
        }

        // 실패했던 패키지도 다시 시도
        const pct = ((i / packages.length) * 100).toFixed(1);
        process.stdout.write(`\r[${pct}%] ${i+1}/${packages.length} - ${pkg.name}...`.padEnd(60));

        try {
            // Example 코드 로드
            const examplePath = path.join(CONFIG.EXAMPLES_DIR, `${pkg.name}.txt`);
            const exampleCode = fs.existsSync(examplePath)
                ? fs.readFileSync(examplePath, 'utf-8')
                : null;

            // 가이드 생성
            const guide = await generateGuide(pkg, exampleCode);

            // 저장
            const guidePath = path.join(CONFIG.GUIDES_DIR, `${pkg.name}.json`);
            fs.writeFileSync(guidePath, JSON.stringify(guide, null, 2));

            progress.completed.push(pkg.name);
            generated++;

            await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);

            // 배치마다 진행 상황 저장
            if ((generated + failed) % CONFIG.BATCH_SIZE === 0) {
                saveProgress(progress);
                console.log(`\n   ✅ ${generated} 생성, ${failed} 실패, ${skipped} 스킵`);
                await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
            }

        } catch (error) {
            progress.failed.push({ name: pkg.name, error: error.message });
            failed++;
            console.log(`\n   ❌ ${pkg.name}: ${error.message}`);
            await sleep(2000); // 에러 시 잠시 대기
        }
    }

    // 최종 저장
    progress.lastIndex = packages.length;
    saveProgress(progress);

    console.log('\n\n========================================');
    console.log('  완료!');
    console.log(`  ✅ 생성: ${generated}`);
    console.log(`  ⏭️  스킵: ${skipped}`);
    console.log(`  ❌ 실패: ${failed}`);
    console.log(`  📁 저장 위치: ${CONFIG.GUIDES_DIR}`);
    console.log('========================================\n');
}

main().catch(console.error);
