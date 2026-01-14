import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

// 데이터 파일 경로
const SLIM_DATA_PATH = path.join(_dirname, '..', 'data', 'top_packages_slim.json');

// 전역 캐시 (Netlify Function 인스턴스 생존 기간 동안 유지)
let cachedPackages = null;

/**
 * 로컬 패키지 정보를 로드하고 캐싱합니다.
 */
function loadPackages() {
    if (cachedPackages) return cachedPackages;

    try {
        if (fs.existsSync(SLIM_DATA_PATH)) {
            const rawData = fs.readFileSync(SLIM_DATA_PATH, 'utf-8');
            cachedPackages = JSON.parse(rawData);
            console.log(`[Local Knowledge Base] ${cachedPackages.length}개 패키지 정보 로드됨`);
            return cachedPackages;
        }
    } catch (error) {
        console.error('[Local Knowledge Base] 로딩 에러:', error.message);
    }
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
