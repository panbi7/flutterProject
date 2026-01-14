import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

// generated-guides 디렉토리 경로 (프로젝트 루트)
const GENERATED_GUIDES_DIR = path.join(_dirname, '..', '..', '..', 'generated-guides');

/**
 * 패키지 검색 함수
 * 1단계: generated-guides 디렉토리에서 검색
 * @param {string} packageName - 검색할 패키지 이름
 * @returns {Object|null} - 검색 결과 또는 null
 */
export async function searchPackage(packageName) {
  if (!packageName || typeof packageName !== 'string') {
    return null;
  }

  const normalizedName = packageName.trim().toLowerCase();

  // 1. generated-guides에서 검색
  const guideResult = await searchInGeneratedGuides(normalizedName);
  if (guideResult) {
    return {
      packageName: normalizedName,
      source: 'pregenerated',
      guide: guideResult,
      packageInfo: {
        name: normalizedName,
        pubDevUrl: `https://pub.dev/packages/${normalizedName}`
      }
    };
  }

  // 패키지를 찾지 못함
  return null;
}

/**
 * generated-guides 디렉토리에서 패키지 가이드 검색
 * @param {string} packageName - 패키지 이름
 * @returns {string|null} - 가이드 내용 또는 null
 */
async function searchInGeneratedGuides(packageName) {
  try {
    // 파일명 변환: http -> http.txt, flutter_bloc -> flutter_bloc.txt
    const fileName = `${packageName.replace(/-/g, '_')}.txt`;
    const filePath = path.join(GENERATED_GUIDES_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      // 대시 버전도 시도
      const dashFileName = `${packageName.replace(/_/g, '-')}.txt`;
      const dashFilePath = path.join(GENERATED_GUIDES_DIR, dashFileName);

      if (!fs.existsSync(dashFilePath)) {
        console.log(`[PACKAGE-SEARCH] 가이드 파일 없음: ${fileName}`);
        return null;
      }

      const content = fs.readFileSync(dashFilePath, 'utf8');
      console.log(`[PACKAGE-SEARCH] 가이드 발견: ${dashFileName}`);
      return content;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`[PACKAGE-SEARCH] 가이드 발견: ${fileName}`);
    return content;
  } catch (error) {
    console.error(`[PACKAGE-SEARCH] 가이드 검색 오류:`, error.message);
    return null;
  }
}

/**
 * 사용 가능한 모든 패키지 가이드 목록 조회
 * @returns {Array<string>} - 패키지 이름 배열
 */
export function getAvailablePackages() {
  try {
    if (!fs.existsSync(GENERATED_GUIDES_DIR)) {
      return [];
    }

    const files = fs.readdirSync(GENERATED_GUIDES_DIR);
    const packages = files
      .filter(file => file.endsWith('.txt'))
      .map(file => file.replace('.txt', ''));

    return packages;
  } catch (error) {
    console.error('[PACKAGE-SEARCH] 패키지 목록 조회 실패:', error.message);
    return [];
  }
}
