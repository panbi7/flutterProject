/**
 * Netlify Function: /api/health
 * 헬스 체크 엔드포인트
 * 
 * GET /api/health
 */

import { ENV } from '../../backend/config/env.js';

export async function handler(event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: {
                nodeEnv: ENV.NODE_ENV,
                isProduction: ENV.IS_PRODUCTION,
                isNetlify: ENV.IS_NETLIFY,
                geminiConfigured: !!ENV.GEMINI_API_KEY,
                geminiModel: ENV.GEMINI_MODEL,
            },
        }),
    };
}
