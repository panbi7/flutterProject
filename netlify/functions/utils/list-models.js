import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
    if (!GEMINI_API_KEY) {
        console.error('API Key가 .env 파일에 없습니다.');
        return;
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    console.log('--- 사용 가능 모델 확인 시도 ---');
    const commonModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro'];

    for (const m of commonModels) {
        try {
            console.log(`Checking ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            const response = await result.response;
            console.log(`[SUCCESS] ${m} is working! Response: ${response.text().substring(0, 20)}...`);
            break; // 하나라도 성공하면 중단
        } catch (e) {
            console.log(`[FAILED] ${m}: ${e.message.split('\n')[0]}`);
        }
    }
}

listModels();
