/**
 * 패키지 검색 테스트 스크립트
 * 로컬에서 패키지 검색 기능을 테스트합니다
 */

import { searchPackage } from './backend/services/package-search.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

async function test() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 패키지 검색 시스템 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testPackages = [
    'http',          // top100에 있는 패키지
    'provider',      // top100에 있는 패키지
    'dio',           // top100에 있을 가능성이 있는 패키지
    'get_it',        // 테스트용 - pub.dev에서 조회될 패키지
  ];

  for (const packageName of testPackages) {
    console.log(`\n🔍 테스트: "${packageName}" 검색`);
    console.log('─────────────────────────────────────────────────\n');

    try {
      const result = await searchPackage(packageName);

      if (result) {
        console.log(`✅ 검색 성공!`);
        console.log(`   - 패키지명: ${result.packageName}`);
        console.log(`   - 출처: ${result.source}`);
        console.log(`   - 가이드 길이: ${result.guide.length}자`);
        console.log(`   - 가이드 미리보기:\n`);
        console.log(result.guide.substring(0, 500) + '...\n');
      } else {
        console.log(`❌ "${packageName}" 패키지를 찾을 수 없습니다.\n`);
      }
    } catch (error) {
      console.error(`❌ 오류 발생:`, error.message);
    }

    // API 제한 방지를 위해 1초 대기
    if (testPackages.indexOf(packageName) < testPackages.length - 1) {
      console.log('⏳ 1초 대기...\n');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('테스트 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

test().catch(console.error);
