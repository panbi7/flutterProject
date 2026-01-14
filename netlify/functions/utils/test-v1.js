import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testV1() {
    if (!GEMINI_API_KEY) {
        console.error('API Key가 .env 파일에 없습니다.');
        return;
    }

    // v1 엔드포인트를 시도해보기 위해 직접 fetch를 사용할 수도 있지만,
    // SDK 옵션에서apiVersion을 설정할 수 있는지 확인해봅시다.
    // 최신 SDK는 GoogleGenerativeAI 생성자에서 옵션을 받을 수 있습니다.

    try {
        console.log('--- v1 API 테스트 ---');
        // 일부 SDK 버전에서는 생성자의 두 번째 인자로 옵션을 받습니다.
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

        // 모델명 뒤에 버전을 붙여보기
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1' });
        const result = await model.generateContent("Hi");
        console.log('[SUCCESS] v1 API working with gemini-1.5-flash');
    } catch (e) {
        console.log(`[FAILED] v1 API: ${e.message}`);

        console.log('\n--- cURL 방식 테스트 시도 ---');
        // cURL을 통한 직접 호출 테스트 (가장 확실함)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: "Hi" }] }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok) {
                console.log('[SUCCESS] REST API v1 working!');
            } else {
                console.log(`[FAILED] REST API v1: ${JSON.stringify(data)}`);
            }
        } catch (e2) {
            console.log(`[FAILED] Fetch: ${e2.message}`);
        }
    }
}

testV1();
