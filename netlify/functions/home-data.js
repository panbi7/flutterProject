import fs from 'fs/promises';
import path from 'path';

// data/top_packages.json 파일의 전체 경로를 올바르게 설정합니다.
const TOP_PACKAGES_PATH = path.resolve(process.cwd(), 'netlify/functions/data/top_packages.json');

export async function handler(event) {
  try {
    const data = await fs.readFile(TOP_PACKAGES_PATH, 'utf-8');
    const packages = JSON.parse(data);
    
    // 프론트엔드에서 필요한 형식으로 데이터를 가공할 수 있습니다.
    // 여기서는 간단히 전체를 반환합니다.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyWidgets: packages }), // App.jsx의 형식에 맞춤
    };
  } catch (error) {
    console.error('Failed to read top_packages.json:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to load home data.' }),
    };
  }
}