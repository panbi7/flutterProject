import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)) }
  catch (e) { return typeof __dirname !== 'undefined' ? __dirname : process.cwd() }
})()
const dataDir = path.join(_dirname, '..', 'data');
const generatedGuidesDir = path.join(_dirname, '..', '..', 'generated-guides');


/**
 * 패키지 ID로 가이드 파일 로드 (JSON 또는 TXT)
 * @param {string} packageId - 패키지 ID (예: 'firebase_auth', 'dio')
 * @returns {Object|null} - 가이드 데이터 (JSON 객체 또는 { plainText: "..." }) 또는 null
 */
export function loadGuide(packageId) {
  try {
    // 1. /data/examples/{packageId}.json 먼저 확인
    // const jsonGuidePath = path.join(dataDir, 'examples', `${packageId}.json`);

    // if (fs.existsSync(jsonGuidePath)) {
    //   const rawData = fs.readFileSync(jsonGuidePath, 'utf8');
    //   return JSON.parse(rawData);
    // }
    // [Changed] 사용자가 실시간 스크래핑을 원하므로, 정적 JSON 파일 로드 로직을 비활성화합니다.
    // 필요 시 다시 주석을 해제하거나 이 부분을 로직의 뒷순위(fallback)로 옮길 수 있습니다.

    // 2. 없으면 /generated-guides/{packageId}.txt 확인
    const txtGuidePath = path.join(generatedGuidesDir, `${packageId}.txt`);

    if (fs.existsSync(txtGuidePath)) {
      const rawData = fs.readFileSync(txtGuidePath, 'utf8');
      // 3. txt 파일이면 { plainText: 내용 } 형태로 반환
      return { plainText: rawData };
    }

    console.log(`가이드 파일 없음: ${packageId}.json 또는 ${packageId}.txt`);
    return null;

  } catch (error) {
    console.error(`가이드 로드 실패 (${packageId}):`, error.message);
    return null;
  }
}

/**
 * 사용 가능한 모든 가이드 목록 조회 (JSON + TXT)
 * @returns {Array} - 가이드 ID 배열
 */
export function getAvailableGuides() {
  const guides = new Set();
  try {
    // JSON 가이드 목록
    const examplesDir = path.join(dataDir, 'examples');
    if (fs.existsSync(examplesDir)) {
      fs.readdirSync(examplesDir)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
        .forEach(guide => guides.add(guide));
    }

    // TXT 가이드 목록
    if (fs.existsSync(generatedGuidesDir)) {
      fs.readdirSync(generatedGuidesDir)
        .filter(file => file.endsWith('.txt'))
        .map(file => file.replace('.txt', ''))
        .forEach(guide => guides.add(guide));
    }

    return Array.from(guides);
  } catch (error) {
    console.error('가이드 목록 조회 실패:', error.message);
    return [];
  }
}
