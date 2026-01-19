import fs from 'fs/promises';
import path from 'path';

// 데이터 소스를 top_packages.json으로 변경
const INDEX_PATH = path.resolve(process.cwd(), 'netlify/functions/data/top_packages.json');
let packageIndex = null;

async function loadIndex() {
  if (packageIndex) return packageIndex;
  try {
    const data = await fs.readFile(INDEX_PATH, 'utf-8');
    const topPackages = JSON.parse(data);
    // 객체 배열에서 패키지 이름만 추출하여 인덱스 생성
    packageIndex = topPackages.map(p => p.packageName);
    return packageIndex;
  } catch (error) {
    console.error('Failed to load package index from top_packages.json. Error:', error);
    return [];
  }
}

async function findPackages(query) {
  const index = await loadIndex();
  if (!query) {
    return index.slice(0, 50); // 쿼리 없으면 전체 반환 (최대 100개)
  }
  const lowerCaseQuery = query.toLowerCase();
  return index.filter(pkg => pkg.includes(lowerCaseQuery)).slice(0, 50);
}

export const searchService = { findPackages };
