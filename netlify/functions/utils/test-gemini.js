import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// .env 파일 로드
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash-latest';

async function testGemini() {
    console.log('--- Gemini 연동 테스트 시작 ---');
    console.log('Model:', GEMINI_MODEL);
    console.log('API Key exists:', !!GEMINI_API_KEY);

    if (!GEMINI_API_KEY) {
        console.error('API Key가 .env 파일에 없습니다.');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        const prompt = "안녕! 너는 누구야? 한국어로 간단하게 대답해줘.";
        console.log('Prompt:', prompt);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('\n--- AI 응답 ---');
        console.log(text);
        console.log('------------------');
        console.log('테스트 성공!');
    } catch (error) {
        console.error('\n--- 테스트 실패 ---');
        console.error(error.message);
    }
}

testGemini();
