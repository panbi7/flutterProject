import { pubDevService } from './pub-dev.service.js';
import { aiService } from './ai.service.js';
import { cacheService } from './cache.service.js';

async function generateGuide(packageId) {
  // 1. 패키지 최신 정보 가져오기 (캐시 키 생성을 위해 버전 필요)
  const packageInfo = await pubDevService.getPackageInfo(packageId);
  const version = packageInfo.latest.version;
  const cacheKey = `${packageId}@${version}`;

  // 2. 캐시 확인
  const cachedGuide = await cacheService.get(cacheKey);
  if (cachedGuide) {
    return { ...cachedGuide, source: 'cache' };
  }

  // 3. 캐시 없으면 정보 수집 (API + 스크래핑)
  console.log(`Generating new guide for ${cacheKey}...`);
  const exampleCode = await pubDevService.getExampleCode(packageId);

  // 4. 프롬프트 생성 및 AI 호출
  const prompt = aiService.createPrompt(packageInfo, exampleCode);
  const guide = await aiService.generate(prompt);

  // 5. 캐시에 저장
  await cacheService.set(cacheKey, guide);

  return { ...guide, source: 'generated' };
}

export const guideService = { generateGuide };
