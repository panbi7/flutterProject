import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const PUB_SEARCH_URL = 'https://pub.dev/api/search?q=flutter&page=';
const OUTPUT_PATH = path.resolve(process.cwd(), 'data/package-index.json');

async function fetchAllPackageNames() {
  let page = 1;
  const allPackageNames = new Set();
  let hasNextPage = true;

  console.log('Fetching all Flutter package names from pub.dev...');

  while (hasNextPage) {
    try {
      const response = await fetch(`${PUB_SEARCH_URL}${page}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.packages && data.packages.length > 0) {
        data.packages.forEach(pkg => allPackageNames.add(pkg.package));
        console.log(`Page ${page}: Found ${data.packages.length} packages. Total unique: ${allPackageNames.size}`);
        page++;
      } else {
        hasNextPage = false;
      }
      // Rate limit 방지를 위한 약간의 딜레이
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasNextPage = false;
    }
  }

  return Array.from(allPackageNames).sort();
}

async function main() {
  const packageNames = await fetchAllPackageNames();
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(packageNames, null, 2));
  console.log(`
Successfully saved ${packageNames.length} package names to ${OUTPUT_PATH}`);
}

main();
