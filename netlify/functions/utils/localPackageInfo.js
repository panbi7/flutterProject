import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATA_DIR } from './constants.js';

// 데이터 파일 경로 (constants.js의 안정적인 DATA_DIR 기반으로 설정)
const SLIM_DATA_PATH = path.join(DATA_DIR, 'top_packages_slim.json');

// 전역 캐시 (Netlify Function 인스턴스 생존 기간 동안 유지)
let cachedPackages = null;

/**
 * 로컬 패키지 정보를 로드하고 캐싱합니다. (다중 경로 탐색 지원)
 */
function loadPackages() {
    if (cachedPackages) return cachedPackages;

    // Netlify 환경 대응을 위한 다중 경로 탐색
    const potentialPaths = [
        SLIM_DATA_PATH, // 기본 (constants.js의 DATA_DIR 기반)
        path.join(process.cwd(), 'netlify/functions/data', 'top_packages_slim.json'),
        path.join(process.cwd(), '.netlify/functions-internal', 'top_packages_slim.json'),
        path.join(DATA_DIR, 'top_packages_slim.json')
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
    const pkg = packages.find(p => p.n.toLowerCase() === packageName.toLowerCase());

    if (pkg) {
        return {
            name: pkg.n,
            description: pkg.d,
            exampleCode: pkg.e,
            tags: pkg.t
        };
    }
    return null;
}
