#!/usr/bin/env node

/**
 * 모든 example 파일을 하나의 JSON으로 번들링
 *
 * 출력: netlify/functions/data/examples.json
 * 형식: { "package-name": "example code", ... }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const EXAMPLES_DIR = path.join(ROOT_DIR, 'data', 'examples');
const OUTPUT_FILE = path.join(ROOT_DIR, 'netlify', 'functions', 'data', 'examples.json');

function bundleExamples() {
    console.log('📦 Example 파일 번들링 시작...');

    if (!fs.existsSync(EXAMPLES_DIR)) {
        console.error(`❌ Examples 디렉토리가 없습니다: ${EXAMPLES_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.txt'));
    console.log(`   ${files.length}개 파일 발견`);

    const bundle = {};
    let totalSize = 0;

    for (const file of files) {
        const packageName = file.replace('.txt', '');
        const filePath = path.join(EXAMPLES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        bundle[packageName] = content;
        totalSize += content.length;
    }

    // 출력 디렉토리 확인
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // JSON 저장 (압축)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(bundle));

    const outputSize = fs.statSync(OUTPUT_FILE).size;
    console.log(`✅ 번들 완료!`);
    console.log(`   패키지 수: ${Object.keys(bundle).length}`);
    console.log(`   원본 크기: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   출력 크기: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   출력 경로: ${OUTPUT_FILE}`);
}

bundleExamples();
