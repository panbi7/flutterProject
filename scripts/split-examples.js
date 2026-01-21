#!/usr/bin/env node

/**
 * all-packages.json에서 exampleCode를 개별 파일로 분리하는 스크립트
 * 이렇게 하면 guide 함수에서 필요한 패키지의 example만 빠르게 로드 가능
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PACKAGES_FILE = path.join(ROOT_DIR, 'data', 'all-packages.json');
const EXAMPLES_DIR = path.join(ROOT_DIR, 'data', 'examples');
const PACKAGES_LITE_FILE = path.join(ROOT_DIR, 'data', 'packages-lite.json');

async function main() {
    console.log('Loading packages data...');
    const data = JSON.parse(fs.readFileSync(PACKAGES_FILE, 'utf-8'));
    const packages = data.packages;

    // examples 디렉토리 생성
    fs.mkdirSync(EXAMPLES_DIR, { recursive: true });

    let exampleCount = 0;
    const packagesLite = [];

    for (const pkg of packages) {
        // 기본 정보만 추출 (exampleCode 제외)
        const { exampleCode, ...pkgLite } = pkg;
        packagesLite.push(pkgLite);

        // exampleCode가 있으면 개별 파일로 저장
        if (exampleCode) {
            const exampleFile = path.join(EXAMPLES_DIR, `${pkg.name}.txt`);
            fs.writeFileSync(exampleFile, exampleCode);
            exampleCount++;
        }
    }

    // packages-lite.json 저장 (exampleCode 없는 버전)
    const liteData = {
        lastUpdated: data.lastUpdated,
        totalPackages: packagesLite.length,
        packages: packagesLite
    };
    fs.writeFileSync(PACKAGES_LITE_FILE, JSON.stringify(liteData, null, 2));

    console.log(`\nDone!`);
    console.log(`- ${exampleCount} example files created in ${EXAMPLES_DIR}`);
    console.log(`- packages-lite.json saved (${(fs.statSync(PACKAGES_LITE_FILE).size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`- Original all-packages.json: ${(fs.statSync(PACKAGES_FILE).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
