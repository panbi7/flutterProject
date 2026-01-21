#!/usr/bin/env node

/**
 * pub.dev에서 모든 Flutter 패키지 데이터를 수집하는 스크립트
 *
 * 기능:
 * - 전체 패키지 목록 수집 (이름)
 * - 각 패키지의 상세 정보 및 점수 수집
 * - 진행 상황 저장 (중단 후 재개 가능)
 * - Rate Limit 대응
 *
 * 사용법:
 *   node scripts/collect-all-packages.js
 *   node scripts/collect-all-packages.js --resume  # 이전 진행 상황에서 재개
 *   node scripts/collect-all-packages.js --details-only  # 상세 정보만 수집 (이름 목록 있을 때)
 *   node scripts/collect-all-packages.js --examples-only  # example 코드만 수집 (상위 500개)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 설정
const CONFIG = {
    // API 설정
    PUBDEV_SEARCH_URL: 'https://pub.dev/api/search',
    PUBDEV_PACKAGE_URL: (name) => `https://pub.dev/api/packages/${name}`,
    PUBDEV_SCORE_URL: (name) => `https://pub.dev/api/packages/${name}/score`,
    PUBDEV_EXAMPLE_URL: (name) => `https://pub.dev/packages/${name}/example`,
    USER_AGENT: 'FlutterStarterKit/1.0 (https://github.com/example)',

    // Rate Limit 설정
    DELAY_BETWEEN_REQUESTS: 300,      // 요청 간 대기 (ms)
    DELAY_BETWEEN_BATCHES: 2000,      // 배치 간 대기 (ms)
    BATCH_SIZE: 50,                   // 한 배치당 패키지 수
    MAX_RETRIES: 3,                   // 최대 재시도 횟수
    RETRY_DELAY: 5000,                // 재시도 전 대기 (ms)

    // Example 코드 수집 설정
    COLLECT_EXAMPLES_FOR_TOP: 99999,  // 전체 패키지 example 수집

    // 파일 경로
    PROGRESS_FILE: path.join(ROOT_DIR, 'data', 'collection-progress.json'),
    PACKAGES_FILE: path.join(ROOT_DIR, 'data', 'all-packages.json'),
    INDEX_FILE: path.join(ROOT_DIR, 'data', 'package-index.json'),
};

// 유틸리티 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = {
    info: (msg, data) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
    warn: (msg, data) => console.log(`[WARN] ${msg}`, data ? JSON.stringify(data) : ''),
    error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data) : ''),
    progress: (current, total, msg) => {
        const pct = ((current / total) * 100).toFixed(1);
        process.stdout.write(`\r[${pct}%] ${current}/${total} - ${msg}`.padEnd(80));
    }
};

// 진행 상황 관리
function loadProgress() {
    try {
        if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
            return data;
        }
    } catch (e) {
        log.warn('Failed to load progress file', { error: e.message });
    }
    return {
        phase: 'names',  // 'names' | 'details'
        namesNextUrl: null,
        packageNames: [],
        detailsIndex: 0,
        packages: [],
        lastUpdated: null,
    };
}

function saveProgress(progress) {
    fs.mkdirSync(path.dirname(CONFIG.PROGRESS_FILE), { recursive: true });
    fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// API 호출 함수
async function fetchWithRetry(url, retries = CONFIG.MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': CONFIG.USER_AGENT }
            });

            if (response.status === 429) {
                log.warn(`Rate limited, waiting ${CONFIG.RETRY_DELAY * (i + 1)}ms...`);
                await sleep(CONFIG.RETRY_DELAY * (i + 1));
                continue;
            }

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            log.warn(`Retry ${i + 1}/${retries}`, { url, error: error.message });
            await sleep(CONFIG.RETRY_DELAY);
        }
    }
}

// Phase 1: 패키지 이름 목록 수집
async function collectPackageNames(progress) {
    log.info('Phase 1: Collecting package names...');

    const packageNames = new Set(progress.packageNames);
    let nextUrl = progress.namesNextUrl;
    let pageCount = Math.floor(packageNames.size / 100);

    // 초기 검색 쿼리들 (더 많은 패키지를 찾기 위해)
    const searchQueries = ['flutter', 'dart'];

    for (const query of searchQueries) {
        if (!nextUrl) {
            nextUrl = `${CONFIG.PUBDEV_SEARCH_URL}?q=${query}`;
        }

        while (nextUrl) {
            try {
                const data = await fetchWithRetry(nextUrl);
                if (!data) break;

                const packages = (data.packages || []).map(pkg => pkg.package);
                packages.forEach(name => packageNames.add(name));

                nextUrl = data.next || null;
                pageCount++;

                log.progress(packageNames.size, 60000, `Page ${pageCount}, Query: ${query}`);

                // 진행 상황 저장 (10페이지마다)
                if (pageCount % 10 === 0) {
                    progress.packageNames = Array.from(packageNames);
                    progress.namesNextUrl = nextUrl;
                    saveProgress(progress);
                }

                await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
            } catch (error) {
                log.error('Failed to fetch page', { error: error.message });
                progress.packageNames = Array.from(packageNames);
                progress.namesNextUrl = nextUrl;
                saveProgress(progress);
                throw error;
            }
        }

        nextUrl = null; // 다음 쿼리를 위해 리셋
    }

    console.log(''); // 줄바꿈
    log.info(`Phase 1 complete: ${packageNames.size} packages found`);

    progress.packageNames = Array.from(packageNames);
    progress.phase = 'details';
    progress.namesNextUrl = null;
    saveProgress(progress);

    return progress;
}

// Phase 2: 패키지 상세 정보 수집
async function collectPackageDetails(progress) {
    log.info('Phase 2: Collecting package details...');

    const packageNames = progress.packageNames;
    const packages = progress.packages || [];
    let index = progress.detailsIndex || 0;
    const existingNames = new Set(packages.map(p => p.name));

    const total = packageNames.length;
    let successCount = 0;
    let errorCount = 0;

    for (; index < total; index++) {
        const name = packageNames[index];

        // 이미 수집된 패키지는 건너뛰기
        if (existingNames.has(name)) {
            log.progress(index + 1, total, `Skipping ${name} (already collected)`);
            continue;
        }

        try {
            log.progress(index + 1, total, `Fetching ${name}...`);

            // 패키지 정보와 점수를 동시에 가져오기
            const [pkgInfo, scoreInfo] = await Promise.all([
                fetchWithRetry(CONFIG.PUBDEV_PACKAGE_URL(name)),
                fetchWithRetry(CONFIG.PUBDEV_SCORE_URL(name)),
            ]);

            if (pkgInfo) {
                const latest = pkgInfo.latest || {};
                const pubspec = latest.pubspec || {};

                packages.push({
                    name: pkgInfo.name,
                    version: latest.version || '',
                    description: pubspec.description || '',
                    homepage: pubspec.homepage || '',
                    repository: pubspec.repository || '',
                    published: latest.published || '',
                    // 점수 정보
                    likes: scoreInfo?.likeCount || 0,
                    pubPoints: scoreInfo?.grantedPoints || 0,
                    popularity: Math.round((scoreInfo?.popularityScore || 0) * 100),
                    // 태그 및 플랫폼
                    tags: scoreInfo?.tags || [],
                    platforms: extractPlatforms(scoreInfo?.tags || []),
                    // 추가 정보
                    publisher: pkgInfo.publisher?.publisherId || '',
                    isFlutterFavorite: (scoreInfo?.tags || []).includes('is:flutter-favorite'),
                });

                successCount++;
            }

            // Rate limit 대기
            await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);

            // 배치마다 진행 상황 저장
            if ((index + 1) % CONFIG.BATCH_SIZE === 0) {
                progress.packages = packages;
                progress.detailsIndex = index + 1;
                saveProgress(progress);
                log.info(`\nBatch saved at index ${index + 1}`);
                await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
            }
        } catch (error) {
            errorCount++;
            log.error(`\nFailed to fetch ${name}`, { error: error.message });

            // 에러가 많으면 중단
            if (errorCount > 10) {
                log.error('Too many errors, stopping...');
                progress.packages = packages;
                progress.detailsIndex = index;
                saveProgress(progress);
                throw new Error('Too many errors');
            }
        }
    }

    console.log(''); // 줄바꿈
    log.info(`Phase 2 complete: ${successCount} packages collected, ${errorCount} errors`);

    progress.packages = packages;
    progress.detailsIndex = index;
    progress.lastUpdated = new Date().toISOString();
    saveProgress(progress);

    return progress;
}

// 플랫폼 추출
function extractPlatforms(tags) {
    const platformTags = tags.filter(t => t.startsWith('platform:'));
    return platformTags.map(t => t.replace('platform:', ''));
}

// Example 코드 스크래핑 (HTML 파싱)
async function fetchExampleCode(packageName) {
    try {
        const url = CONFIG.PUBDEV_EXAMPLE_URL(packageName);
        const response = await fetch(url, {
            headers: { 'User-Agent': CONFIG.USER_AGENT }
        });

        if (!response.ok) {
            return null;
        }

        const html = await response.text();

        // 간단한 정규식으로 코드 블록 추출 (cheerio 없이)
        // pub.dev의 example 페이지에서 <pre><code> 블록을 찾음
        const codeMatch = html.match(/<pre[^>]*class="[^"]*language-dart[^"]*"[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/i);

        if (codeMatch && codeMatch[1]) {
            // HTML 엔티티 디코딩
            let code = codeMatch[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/<[^>]+>/g, ''); // 남은 HTML 태그 제거

            // 코드가 너무 길면 자르기 (4000자 제한)
            if (code.length > 4000) {
                code = code.substring(0, 4000) + '\n// ... (truncated)';
            }

            return code.trim();
        }

        // fallback: 일반 pre>code 블록
        const fallbackMatch = html.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/i);
        if (fallbackMatch && fallbackMatch[1]) {
            let code = fallbackMatch[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/<[^>]+>/g, '');

            if (code.length > 4000) {
                code = code.substring(0, 4000) + '\n// ... (truncated)';
            }

            return code.trim();
        }

        return null;
    } catch (error) {
        return null;
    }
}

// Phase 3: Example 코드 수집 (상위 패키지만)
async function collectExampleCodes(progress) {
    log.info('Phase 3: Collecting example codes for top packages...');

    const packages = progress.packages;
    // likes 순으로 정렬된 상위 N개만 example 수집
    const topPackages = packages
        .sort((a, b) => b.likes - a.likes)
        .slice(0, CONFIG.COLLECT_EXAMPLES_FOR_TOP);

    const total = topPackages.length;
    let successCount = 0;
    let skipCount = 0;

    // 패키지 이름으로 빠르게 찾기 위한 맵
    const packageMap = new Map(packages.map(p => [p.name, p]));

    for (let i = 0; i < total; i++) {
        const pkg = topPackages[i];

        // 이미 exampleCode가 있으면 건너뛰기
        if (pkg.exampleCode) {
            skipCount++;
            log.progress(i + 1, total, `Skipping ${pkg.name} (already has example)`);
            continue;
        }

        log.progress(i + 1, total, `Fetching example for ${pkg.name}...`);

        const exampleCode = await fetchExampleCode(pkg.name);

        if (exampleCode) {
            // 원본 packages 배열의 해당 패키지에 exampleCode 추가
            const originalPkg = packageMap.get(pkg.name);
            if (originalPkg) {
                originalPkg.exampleCode = exampleCode;
            }
            successCount++;
        }

        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);

        // 50개마다 진행 상황 저장
        if ((i + 1) % 50 === 0) {
            progress.packages = packages;
            saveProgress(progress);
            log.info(`\nExample batch saved at ${i + 1}`);
        }
    }

    console.log('');
    log.info(`Phase 3 complete: ${successCount} examples collected, ${skipCount} skipped`);

    progress.packages = packages;
    progress.lastUpdated = new Date().toISOString();
    saveProgress(progress);

    return progress;
}

// 최종 데이터 저장
function saveFinalData(progress) {
    log.info('Saving final data...');

    const data = {
        lastUpdated: progress.lastUpdated || new Date().toISOString(),
        totalPackages: progress.packages.length,
        packages: progress.packages.sort((a, b) => b.likes - a.likes), // likes 순으로 정렬
    };

    fs.mkdirSync(path.dirname(CONFIG.PACKAGES_FILE), { recursive: true });
    fs.writeFileSync(CONFIG.PACKAGES_FILE, JSON.stringify(data, null, 2));

    log.info(`Data saved to ${CONFIG.PACKAGES_FILE}`, {
        totalPackages: data.totalPackages,
        fileSize: `${(fs.statSync(CONFIG.PACKAGES_FILE).size / 1024 / 1024).toFixed(2)} MB`
    });

    // 패키지 이름 인덱스도 저장
    fs.writeFileSync(CONFIG.INDEX_FILE, JSON.stringify(progress.packageNames.sort(), null, 2));
    log.info(`Index saved to ${CONFIG.INDEX_FILE}`);
}

// 메인 함수
async function main() {
    const args = process.argv.slice(2);
    const isResume = args.includes('--resume');
    const isDetailsOnly = args.includes('--details-only');
    const isExamplesOnly = args.includes('--examples-only');

    console.log('\n===========================================');
    console.log('  pub.dev Package Data Collector');
    console.log('===========================================\n');

    let progress;

    if (isExamplesOnly) {
        log.info('Examples-only mode: collecting example codes for existing packages...');
        // 기존 패키지 데이터 로드
        if (fs.existsSync(CONFIG.PACKAGES_FILE)) {
            const existingData = JSON.parse(fs.readFileSync(CONFIG.PACKAGES_FILE, 'utf-8'));
            progress = {
                phase: 'examples',
                packageNames: existingData.packages.map(p => p.name),
                packages: existingData.packages,
                lastUpdated: existingData.lastUpdated,
            };
            log.info(`Loaded ${progress.packages.length} packages from existing data`);
        } else {
            log.error('No package data found. Run full collection first.');
            process.exit(1);
        }
    } else if (isResume) {
        log.info('Resuming from previous progress...');
        progress = loadProgress();
    } else if (isDetailsOnly) {
        log.info('Details-only mode: using existing package names...');
        progress = loadProgress();
        if (progress.packageNames.length === 0) {
            // 기존 인덱스 파일 사용
            if (fs.existsSync(CONFIG.INDEX_FILE)) {
                progress.packageNames = JSON.parse(fs.readFileSync(CONFIG.INDEX_FILE, 'utf-8'));
                log.info(`Loaded ${progress.packageNames.length} package names from index`);
            } else {
                log.error('No package names found. Run without --details-only first.');
                process.exit(1);
            }
        }
        progress.phase = 'details';
    } else {
        log.info('Starting fresh collection...');
        progress = loadProgress();
        // 기존 인덱스가 있으면 사용
        if (fs.existsSync(CONFIG.INDEX_FILE) && progress.packageNames.length === 0) {
            progress.packageNames = JSON.parse(fs.readFileSync(CONFIG.INDEX_FILE, 'utf-8'));
            log.info(`Loaded ${progress.packageNames.length} existing package names`);
            progress.phase = 'details';
        }
    }

    try {
        // Phase 1: 패키지 이름 수집 (필요한 경우)
        if (progress.phase === 'names') {
            progress = await collectPackageNames(progress);
        }

        // Phase 2: 상세 정보 수집
        if (progress.phase === 'details') {
            progress = await collectPackageDetails(progress);
        }

        // Phase 3: Example 코드 수집 (상위 패키지)
        if (!isDetailsOnly || isExamplesOnly) {
            progress = await collectExampleCodes(progress);
        }

        // 최종 데이터 저장
        saveFinalData(progress);

        const exampleCount = progress.packages.filter(p => p.exampleCode).length;
        console.log('\n===========================================');
        console.log('  Collection Complete!');
        console.log(`  Total packages: ${progress.packages.length}`);
        console.log(`  Packages with examples: ${exampleCount}`);
        console.log(`  Data file: ${CONFIG.PACKAGES_FILE}`);
        console.log('===========================================\n');

    } catch (error) {
        log.error('Collection failed', { error: error.message });
        log.info('Progress saved. Run with --resume to continue.');
        process.exit(1);
    }
}

main();
