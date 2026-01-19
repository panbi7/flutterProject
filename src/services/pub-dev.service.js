import fetch from 'node-fetch';
import cheerio from 'cheerio';

const API_BASE = 'https://pub.dev/api/packages';

async function getPackageMetrics(packageName) {
  const response = await fetch(`${API_BASE}/${packageName}/metrics`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.scorecard;
}

async function getPackageInfo(packageName) {
  const response = await fetch(`${API_BASE}/${packageName}`);
  if (!response.ok) throw new Error(`Package '${packageName}' not found on pub.dev`);
  return response.json();
}

async function getExampleCode(packageName) {
  try {
    const response = await fetch(`https://pub.dev/packages/${packageName}/example`);
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    // 예제 페이지의 첫 번째 코드 블록을 가져옴
    const code = $('pre.prettyprint').first().text();
    return code || null;
  } catch (error) {
    console.warn(`Could not scrape example for ${packageName}:`, error.message);
    return null;
  }
}

export const pubDevService = {
  getPackageInfo,
  getExampleCode,
  getPackageMetrics,
};
