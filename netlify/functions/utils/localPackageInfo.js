import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATA_DIR } from './constants.js';

// 데이터 파일 경로 (원본 top_packages.json 사용)
const FULL_DATA_PATH = path.join(DATA_DIR, 'top_packages.json');

// 전역 캐시 (Netlify Function 인스턴스 생존 기간 동안 유지)
let cachedPackages = null;

/**
 * 로컬 패키지 정보를 로드하고 캐싱합니다. (다중 경로 탐색 지원)
 */
function loadPackages() {
    if (cachedPackages) return cachedPackages;

    // Netlify 환경 대응을 위한 다중 경로 탐색
    const potentialPaths = [
        FULL_DATA_PATH, // 기본 (constants.js의 DATA_DIR 기반)
        path.join(process.cwd(), 'netlify/functions/data', 'top_packages.json'),
        path.join(process.cwd(), '.netlify/functions-internal', 'top_packages.json'),
        path.join(DATA_DIR, 'top_packages.json')
    ];

    for (const p of potentialPaths) {
        try {
            if (fs.existsSync(p)) {
                const rawData = fs.readFileSync(p, 'utf-8');
                cachedPackages = JSON.parse(rawData);
                console.log(`[Local Knowledge Base] 데이터 로드 성공: ${p} (${cachedPackages.length}개)`);
                return cachedPackages;
            }
        } catch (e) {
            console.warn(`[Local Knowledge Base] 경로 시도 실패 (${p}):`, e.message);
        }
    }

    console.error('[Local Knowledge Base] 모든 경로에서 데이터 파일을 찾을 수 없습니다.');
    return [];
}

/**
 * 패키지명으로 상세 정보를 조회합니다.
 * @param {string} packageName 
 * @returns {Object|null}
 */
export function getLocalPackageInfo(packageName) {
    const packages = loadPackages();
    const pkg = packages.find(p => p.packageName.toLowerCase() === packageName.toLowerCase());

    if (pkg) {
        return {
            name: pkg.packageName,
            description: pkg.description,
            exampleCode: pkg.exampleCode,
            tags: pkg.tags
        };
    }
    return null;
}
