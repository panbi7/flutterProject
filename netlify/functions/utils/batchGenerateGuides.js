import 'dotenv/config';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateGuideFromPubDev } from './guideGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANALYSIS_PATH = path.join(__dirname, 'package_analysis.json');
const EXAMPLES_DIR = path.join(__dirname, '..', 'data', 'examples');

async function batchGenerate() {
    try {
        // 1. 패키지 목록 로드
        if (!existsSync(ANALYSIS_PATH)) {
            console.error('package_analysis.json 파일을 찾을 수 없습니다. 분석 스크립트를 먼저 실행하세요.');
            return;
        }
        const analysis = JSON.parse(await fs.readFile(ANALYSIS_PATH, 'utf-8'));
        const packages = analysis.packages;

        console.log(`총 ${packages.length}개의 패키지 가이드 생성을 시작합니다.`);

        // 2. examples 디렉토리 확인
        if (!existsSync(EXAMPLES_DIR)) {
            await fs.mkdir(EXAMPLES_DIR, { recursive: true });
        }

        // 3. 순차적 생성 (할당량 제한 방지)
        for (let i = 0; i < packages.length; i++) {
            const pkgName = packages[i];
            const filePath = path.join(EXAMPLES_DIR, `${pkgName}.json`);

            // 이미 존재하면 건너뜀
            if (existsSync(filePath)) {
                console.log(`[${i + 1}/${packages.length}] 이미 존재함: ${pkgName}`);
                continue;
            }

            console.log(`[${i + 1}/${packages.length}] 생성 중: ${pkgName}...`);

            try {
                const guide = await generateGuideFromPubDev(pkgName);
                if (guide) {
                    await fs.writeFile(filePath, JSON.stringify(guide, null, 2));
                    console.log(`   완료: ${pkgName}`);
                } else {
                    console.warn(`   실패: ${pkgName} 가이드를 생성할 수 없습니다.`);
                }
            } catch (e) {
                console.error(`   에러: ${pkgName} - ${e.message}`);
                // 할당량 초과 시 잠시 대기
                if (e.message.includes('429') || e.message.includes('quota')) {
                    console.log('   할당량 초과. 60초 대기 후 재시도...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    i--; // 현재 항목 재시도
                    continue;
                }
            }

            // API 호출 간 충분한 지연 (6초) - Free Tier 할당량(15 RPM) 준수
            await new Promise(resolve => setTimeout(resolve, 6000));
        }

        console.log('\n=== 가이드 일괄 생성 완료 ===');

    } catch (error) {
        console.error('일괄 생성 중 치명적 에러:', error);
    }
}

batchGenerate();
