// JSON을 직접 import (esbuild가 번들에 포함시킴)
// esbuild는 JSON 파일을 자동으로 JavaScript 객체로 변환
import topPackages from '../data/top_packages.json';

/**
 * 패키지명으로 상세 정보를 조회합니다.
 * @param {string} packageName
 * @returns {Object|null}
 */
export function getLocalPackageInfo(packageName) {
    try {
        const packages = topPackages || [];
        const pkg = packages.find(p => p.packageName?.toLowerCase() === packageName?.toLowerCase());

        if (pkg) {
            return {
                name: pkg.packageName,
                description: pkg.description,
                exampleCode: pkg.exampleCode,
                tags: pkg.tags
            };
        }
        return null;
    } catch (error) {
        console.warn('[Local Knowledge Base] 로컬 데이터 조회 실패:', error.message);
        return null;
    }
}
