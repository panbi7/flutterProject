import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const INITIAL_URL = 'https://pub.dev/api/search?q=flutter';
const FINAL_OUTPUT_PATH = path.resolve(process.cwd(), 'data/package-index.json');
const PROGRESS_FILE_PATH = path.resolve(process.cwd(), 'data/index-progress.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

async function loadProgress() {
  try {
    const progressData = await fs.readFile(PROGRESS_FILE_PATH, 'utf-8');
    const progress = JSON.parse(progressData);
    console.log(`Resuming from previous progress. Found ${progress.packages.length} packages.`);
    return {
      nextUrl: progress.nextUrl,
      allPackageNames: new Set(progress.packages),
    };
  } catch (error) {
    console.log('No previous progress found. Starting from scratch.');
    return {
      nextUrl: INITIAL_URL,
      allPackageNames: new Set(),
    };
  }
}

async function saveProgress(packages, nextUrl) {
  const progress = {
    nextUrl: nextUrl,
    packages: Array.from(packages).sort(),
  };
  await fs.writeFile(PROGRESS_FILE_PATH, JSON.stringify(progress, null, 2));
}

async function main() {
  let { nextUrl, allPackageNames } = await loadProgress();
  let page = Math.floor(allPackageNames.size / 10) + 1;
  let retryCount = 0;

  console.log('Fetching all Flutter package names from pub.dev...');

  while (nextUrl) {
    try {
      const response = await fetch(nextUrl, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!response.ok) {
        if (response.status === 429) {
          retryCount++;
          const waitTime = 5 * retryCount;
          console.warn(`Page ${page}: Received 429 Too Many Requests. Waiting ${waitTime} seconds... (Attempt ${retryCount})`);
          
          if (retryCount > 5) {
            throw new Error("Too many retries. Saving progress and aborting. Please run the script again later.");
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      retryCount = 0;
      const data = await response.json();

      if (data.packages && data.packages.length > 0) {
        data.packages.forEach(pkg => allPackageNames.add(pkg.package));
        console.log(`Page ${page}: Found ${data.packages.length} packages. Total unique: ${allPackageNames.size}`);
      }
      
      nextUrl = data.next; 
      page++;

      // 매 페이지마다 진행 상황 저장
      await saveProgress(allPackageNames, nextUrl);

      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error(`
Error: ${error.message}`);
      console.log('Exiting. Your progress has been saved.');
      return; // 스크립트 종료
    }
  }

  // 모든 작업 완료 후 최종 파일 저장 및 임시 파일 삭제
  console.log('\nFetch complete. Finalizing...');
  const finalPackageList = Array.from(allPackageNames).sort();
  await fs.writeFile(FINAL_OUTPUT_PATH, JSON.stringify(finalPackageList, null, 2));
  await fs.unlink(PROGRESS_FILE_PATH); // 임시 진행 파일 삭제
  console.log(`Successfully saved ${finalPackageList.length} package names to ${FINAL_OUTPUT_PATH}`);
}

main();
