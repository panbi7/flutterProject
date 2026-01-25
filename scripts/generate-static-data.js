#!/usr/bin/env node

/**
 * 수집된 패키지 데이터를 정적 파일로 변환하는 스크립트
 *
 * 생성 파일:
 * - frontend/public/data/meta.json          - 메타 정보 및 통계
 * - frontend/public/data/packages-lite.json - 경량 패키지 목록 (가이드 API용)
 * - frontend/public/data/top-100.json       - 인기 상위 100개
 * - frontend/public/data/monthly-widgets.json - 월별 추천 패키지
 *
 * 사용법:
 *   node scripts/generate-static-data.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 설정
const CONFIG = {
    INPUT_FILE: path.join(ROOT_DIR, 'data', 'all-packages.json'),
    OUTPUT_DIR: path.join(ROOT_DIR, 'frontend', 'public', 'data'),
    TOP_COUNT: 100,
};

// 유틸리티
const log = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    success: (msg) => console.log(`[✓] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
};

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function writeJson(filename, data) {
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data));
    const size = (fs.statSync(filepath).size / 1024).toFixed(1);
    log.success(`${filename} (${size} KB)`);
}

function writeJsonPretty(filename, data) {
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    const size = (fs.statSync(filepath).size / 1024).toFixed(1);
    log.success(`${filename} (${size} KB)`);
}

// 메인 함수
async function main() {
    console.log('\n===========================================');
    console.log('  Static Data Generator');
    console.log('===========================================\n');

    // 입력 파일 확인
    if (!fs.existsSync(CONFIG.INPUT_FILE)) {
        log.error(`Input file not found: ${CONFIG.INPUT_FILE}`);
        log.info('Run "node scripts/collect-all-packages.js" first.');
        process.exit(1);
    }

    // 데이터 로드
    log.info('Loading package data...');
    const rawData = JSON.parse(fs.readFileSync(CONFIG.INPUT_FILE, 'utf-8'));
    const packages = rawData.packages || [];
    const lastUpdated = rawData.lastUpdated || new Date().toISOString();

    log.info(`Loaded ${packages.length} packages`);

    // 출력 디렉토리 생성
    ensureDir(CONFIG.OUTPUT_DIR);

    // 1. 메타 정보 생성
    log.info('\nGenerating meta.json...');
    const stats = generateStats(packages);
    const meta = {
        lastUpdated,
        totalPackages: packages.length,
        stats,
        quickCategories: getQuickCategories(),
    };
    writeJsonPretty('meta.json', meta);

    // 2. 경량 패키지 목록 (초기 로딩용)
    log.info('\nGenerating packages-lite.json...');
    const packagesLite = packages.map(pkg => ({
        name: pkg.name,
        description: pkg.description?.substring(0, 100) || '',
        likes: pkg.likes || 0,
        popularity: pkg.popularity || 0,
        pubPoints: pkg.pubPoints || 0,
        platforms: pkg.platforms || [],
        isFlutterFavorite: pkg.isFlutterFavorite || false,
    }));
    writeJson('packages-lite.json', packagesLite);

    // 3. 인기 상위 100개
    log.info('\nGenerating top-100.json...');
    const topByLikes = [...packages]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, CONFIG.TOP_COUNT);
    const topByPopularity = [...packages]
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, CONFIG.TOP_COUNT);
    const topByPubPoints = [...packages]
        .sort((a, b) => (b.pubPoints || 0) - (a.pubPoints || 0))
        .slice(0, CONFIG.TOP_COUNT);

    writeJson('top-100.json', {
        byLikes: topByLikes,
        byPopularity: topByPopularity,
        byPubPoints: topByPubPoints,
    });

    // 4. 월별 추천 패키지 (홈페이지용)
    log.info('\nGenerating monthly-widgets.json...');
    const monthlyWidgets = [...packages]
        .filter(pkg => (pkg.likes || 0) > 100)
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 100)
        .map(pkg => ({
            name: pkg.name,
            description: pkg.description || '',
            version: pkg.version || '',
            likes: pkg.likes || 0,
            popularity: pkg.popularity || 0,
            pubPoints: pkg.pubPoints || 0,
            platforms: pkg.platforms || [],
            isFlutterFavorite: pkg.isFlutterFavorite || false,
            publisher: pkg.publisher || '',
        }));
    writeJson('monthly-widgets.json', monthlyWidgets);

    // 완료 메시지
    console.log('\n===========================================');
    console.log('  Static Data Generation Complete!');
    console.log(`  Output: ${CONFIG.OUTPUT_DIR}`);
    console.log('===========================================\n');

    // 파일 크기 요약
    const files = fs.readdirSync(CONFIG.OUTPUT_DIR).filter(f => f.endsWith('.json'));
    let totalSize = 0;
    files.forEach(file => {
        const size = fs.statSync(path.join(CONFIG.OUTPUT_DIR, file)).size;
        totalSize += size;
    });
    log.info(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    log.info(`Files generated: ${files.length}`);
}

// 통계 생성
function generateStats(packages) {
    const totalLikes = packages.reduce((sum, pkg) => sum + (pkg.likes || 0), 0);
    const totalPubPoints = packages.reduce((sum, pkg) => sum + (pkg.pubPoints || 0), 0);

    // 플랫폼별 카운트
    const platformCounts = {};
    packages.forEach(pkg => {
        (pkg.platforms || []).forEach(platform => {
            platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        });
    });

    // 태그 클라우드 (상위 30개)
    const tagCounts = {};
    packages.forEach(pkg => {
        (pkg.tags || []).forEach(tag => {
            // 플랫폼 태그와 기타 메타 태그 제외
            if (!tag.startsWith('platform:') &&
                !tag.startsWith('is:') &&
                !tag.startsWith('sdk:') &&
                !tag.startsWith('license:')) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        });
    });

    const tagCloud = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([tag, count]) => ({ tag, count }));

    return {
        totalPackages: packages.length,
        totalLikes,
        avgPubPoints: Math.round(totalPubPoints / packages.length),
        flutterFavorites: packages.filter(p => p.isFlutterFavorite).length,
        platformCounts,
        tagCloud,
    };
}

// 빠른 카테고리
function getQuickCategories() {
    return [
        { id: 'auth', label: '인증', icon: '🔐', color: '#4CAF50', keywords: ['auth', 'login', 'firebase_auth'] },
        { id: 'ui', label: 'UI/UX', icon: '🎨', color: '#9C27B0', keywords: ['animation', 'widget', 'design'] },
        { id: 'network', label: '네트워크', icon: '🌐', color: '#2196F3', keywords: ['http', 'dio', 'api', 'network'] },
        { id: 'storage', label: '저장소', icon: '💾', color: '#FF9800', keywords: ['storage', 'database', 'cache'] },
        { id: 'media', label: '미디어', icon: '📷', color: '#E91E63', keywords: ['camera', 'video', 'audio', 'image'] },
        { id: 'device', label: '디바이스', icon: '📱', color: '#00BCD4', keywords: ['device', 'sensor', 'platform'] },
    ];
}

main().catch(err => {
    log.error(err.message);
    process.exit(1);
});
