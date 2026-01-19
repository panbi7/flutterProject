import fs from 'fs/promises';
import path from 'path';

const INDEX_PATH = path.resolve(process.cwd(), 'data/package-index.json');
let packageIndex = null;

async function loadIndex() {
  if (packageIndex) return packageIndex;
  try {
    const data = await fs.readFile(INDEX_PATH, 'utf-8');
    packageIndex = JSON.parse(data);
    return packageIndex;
  } catch (error) {
    console.error('Failed to load package index. Run `npm run update-index`.');
    return [];
  }
}

async function findPackages(query) {
  const index = await loadIndex();
  if (!query) {
    return index.slice(0, 50); // 쿼리 없으면 상위 50개 반환
  }
  const lowerCaseQuery = query.toLowerCase();
  return index.filter(pkg => pkg.includes(lowerCaseQuery)).slice(0, 50);
}

export const searchService = { findPackages };
