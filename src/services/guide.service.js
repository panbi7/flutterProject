import fs from 'fs/promises';
import path from 'path';
import { aiService } from './ai.service.js';
import { cacheService } from './cache.service.js';

const TOP_PACKAGES_PATH = path.resolve(process.cwd(), 'netlify/functions/data/top_packages.json');
let topPackages = null;

async function getLocalPackageData(packageId) {
  if (!topPackages) {
    const data = await fs.readFile(TOP_PACKAGES_PATH, 'utf-8');
    topPackages = JSON.parse(data);
  }
  const packageData = topPackages.find(p => p.packageName === packageId);
  if (!packageData) {
    throw new Error(`Package '${packageId}' not found in local top_packages.json.`);
  }
  return packageData;
}

async function generateGuide(packageId) {
  // 1. 로컬 JSON 파일에서 패키지 정보 가져오기
  const localPackageData = await getLocalPackageData(packageId);
  
  // 로컬 데이터에는 버전 정보가 명확하지 않으므로, 마지막 커밋 날짜 등을 이용해 고유 키 생성
  const version = localPackageData.githubInfo?.lastCommit || 'local';
  const cacheKey = `${packageId}@${version}`;

  // 2. 캐시 확인
  const cachedGuide = await cacheService.get(cacheKey);
  if (cachedGuide) {
    return { ...cachedGuide, source: 'cache' };
  }

  // 3. 캐시 없으면 로컬 데이터로 프롬프트 생성 및 AI 호출
  console.log(`Generating new guide for ${cacheKey} from local data...`);
  
  // pubDevService 대신 localPackageData 사용
  const packageInfoForPrompt = {
    latest: {
      name: localPackageData.packageName,
      version: version,
      description: localPackageData.description,
    }
  };
  const exampleCode = localPackageData.exampleCode;

  const prompt = aiService.createPrompt(packageInfoForPrompt, exampleCode);
  const guide = await aiService.generate(prompt);

  // 5. 캐시에 저장
  await cacheService.set(cacheKey, guide);

  return { ...guide, source: 'generated-from-local' };
}

export const guideService = { generateGuide };
