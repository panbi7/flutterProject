/**
 * 패키지명으로 상세 정보를 조회합니다.
 *
 * 참고: top_packages.json 파일이 제거되었습니다.
 * 이 함수는 호환성을 위해 유지되지만 항상 null을 반환합니다.
 * 패키지 정보는 guideGenerator.js의 packages-lite.json에서 가져옵니다.
 *
 * @param {string} packageName
 * @returns {Object|null}
 */
export function getLocalPackageInfo(packageName) {
    // top_packages.json이 제거되었으므로 항상 null 반환
    // intent.js에서는 이 값이 null이어도 정상 작동합니다
    return null;
}
