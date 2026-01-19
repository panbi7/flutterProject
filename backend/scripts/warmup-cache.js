#!/usr/bin/env node

/**
 * 인기 패키지의 캐시를 미리 워밍업하는 스크립트
 * 
 * 사용법:
 *   node backend/scripts/warmup-cache.js [패키지1] [패키지2] ...
 *   node backend/scripts/warmup-cache.js dio provider riverpod
 */

import { createLogger } from '../utils/logger.js';
import { generateGuide } from '../services/guideGenerator.service.js';

const logger = createLogger('WARMUP_CACHE_SCRIPT');

// 기본 인기 패키지 목록
const DEFAULT_PACKAGES = [
    'dio',
    'provider',
    'riverpod',
    'flutter_bloc',
    'go_router',
    'firebase_auth',
    'firebase_core',
    'shared_preferences',
    'http',
    'cached_network_image',
];

async function main() {
    const args = process.argv.slice(2);
    const packages = args.length > 0 ? args : DEFAULT_PACKAGES;

    logger.info('Starting cache warmup', { packageCount: packages.length });
    console.log(`\n🔥 캐시 워밍업 시작 (${packages.length}개 패키지)\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < packages.length; i++) {
        const packageName = packages[i];
        console.log(`[${i + 1}/${packages.length}] ${packageName} 처리 중...`);

        try {
            await generateGuide(packageName);
            successCount++;
            console.log(`   ✅ 성공\n`);
        } catch (error) {
            failCount++;
            console.log(`   ❌ 실패: ${error.message}\n`);
            logger.error('Failed to warmup cache', { packageName, error: error.message });
        }

        // Rate limit 방지
        if (i < packages.length - 1) {
            await sleep(2000);
        }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ 캐시 워밍업 완료`);
    console.log(`   성공: ${successCount}개`);
    console.log(`   실패: ${failCount}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    logger.info('Cache warmup completed', { success: successCount, failed: failCount });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
