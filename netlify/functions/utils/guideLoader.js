const fs = require('fs');
const path = require('path');

/**
 * 패키지 ID로 가이드 JSON 파일 로드
 * @param {string} packageId - 패키지 ID (예: 'firebase_auth')
 * @returns {Object|null} - 가이드 데이터 또는 null
 */
function loadGuide(packageId) {
  try {
    const guidePath = path.join(__dirname, '../data/examples', `${packageId}.json`);

    // 파일 존재 여부 확인
    if (!fs.existsSync(guidePath)) {
      console.log(`가이드 파일 없음: ${packageId}.json`);
      return null;
    }

    // JSON 파일 읽기
    const rawData = fs.readFileSync(guidePath, 'utf8');
    const guide = JSON.parse(rawData);

    return guide;
  } catch (error) {
    console.error(`가이드 로드 실패 (${packageId}):`, error.message);
    return null;
  }
}

/**
 * 사용 가능한 모든 가이드 목록 조회
 * @returns {Array} - 가이드 ID 배열
 */
function getAvailableGuides() {
  try {
    const examplesDir = path.join(__dirname, '../data/examples');

    if (!fs.existsSync(examplesDir)) {
      return [];
    }

    const files = fs.readdirSync(examplesDir);
    const guides = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    return guides;
  } catch (error) {
    console.error('가이드 목록 조회 실패:', error.message);
    return [];
  }
}

module.exports = {
  loadGuide,
  getAvailableGuides
};
