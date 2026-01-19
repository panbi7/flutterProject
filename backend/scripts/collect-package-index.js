#!/usr/bin/env node

/**
 * pub.dev에서 모든 Flutter 패키지 이름을 수집하는 스크립트
 * 
 * 사용법:
 *   node backend/scripts/collect-package-index.js
 */

import { createLogger } from '../utils/logger.js';
import { fetchPackageListPage } from '../adapters/pubdev.adapter.js';
import { savePackageIndex } from '../services/packageIndex.service.js';

const logger = createLogger('COLLECT_INDEX_SCRIPT');

async function main() {
    logger.info('Starting package index collection');

    const allPackageNames = new Set();
    let nextUrl = null;
    let pageCount = 0;

    try {
        do {
            pageCount++;
            logger.info(`Fetching page ${pageCount}...`);

            const { packages, nextUrl: next } = await fetchPackageListPage(nextUrl);

            // 패키지 이름 추가
            packages.forEach((pkg) => allPackageNames.add(pkg));

            logger.info(`Page ${pageCount} complete`, {
                packagesInPage: packages.length,
                totalUnique: allPackageNames.size,
            });

            nextUrl = next;

            // 진행 상황 주기적으로 저장 (10페이지마다)
            if (pageCount % 10 === 0) {
                await savePackageIndex(Array.from(allPackageNames));
                logger.info('Progress saved', { pageCount, totalPackages: allPackageNames.size });
            }
        } while (nextUrl);

        // 최종 저장
        await savePackageIndex(Array.from(allPackageNames));

        logger.info('Package index collection completed', {
            totalPages: pageCount,
            totalPackages: allPackageNames.size,
        });

        console.log('\n✅ 완료!');
        console.log(`   총 페이지: ${pageCount}`);
        console.log(`   총 패키지: ${allPackageNames.size}`);
        console.log(`   저장 위치: data/index/package-names.json\n`);
    } catch (error) {
        logger.error('Failed to collect package index', { error: error.message });
        console.error('\n❌ 오류 발생:', error.message);
        console.error('   진행 상황은 저장되었습니다. 나중에 다시 실행하세요.\n');
        process.exit(1);
    }
}

main();
