import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드 (프로젝트 루트)
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * 환경 변수 검증 및 내보내기
 */
export const ENV = {
    // Gemini API
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

    // 환경
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    IS_NETLIFY: !!process.env.LAMBDA_TASK_ROOT,

    // 포트
    PORT: parseInt(process.env.PORT || '3000', 10),
};

/**
 * 필수 환경 변수 검증
 */
export function validateEnv() {
    const errors = [];

    if (!ENV.GEMINI_API_KEY) {
        errors.push('GEMINI_API_KEY is required');
    }

    if (errors.length > 0) {
        throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }

    return true;
}

/**
 * 환경 변수 정보 출력 (디버깅용)
 */
export function printEnvInfo() {
    console.log('Environment Configuration:');
    console.log(`  NODE_ENV: ${ENV.NODE_ENV}`);
    console.log(`  IS_PRODUCTION: ${ENV.IS_PRODUCTION}`);
    console.log(`  IS_NETLIFY: ${ENV.IS_NETLIFY}`);
    console.log(`  GEMINI_MODEL: ${ENV.GEMINI_MODEL}`);
    console.log(`  GEMINI_API_KEY: ${ENV.GEMINI_API_KEY ? '✓ Set' : '✗ Not Set'}`);
}
