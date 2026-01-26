/**
 * 디버그 엔드포인트 - 시스템 상태 확인용
 */

import { GEMINI_API_KEY, GEMINI_MODEL } from './utils/constants.js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const { action } = event.queryStringParameters || {};

  // 기본 상태 확인
  const status = {
    timestamp: new Date().toISOString(),
    geminiApiKeySet: !!GEMINI_API_KEY,
    geminiApiKeyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
    geminiApiKeyPrefix: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 8) + '...' : 'NOT SET',
    geminiModel: GEMINI_MODEL,
    nodeVersion: process.version,
    env: {
      URL: process.env.URL || 'not set',
      DEPLOY_URL: process.env.DEPLOY_URL || 'not set',
    },
  };

  // Gemini 테스트
  if (action === 'test-gemini') {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');

      if (!GEMINI_API_KEY) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...status,
            geminiTest: 'FAILED - No API Key',
          }),
        };
      }

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const result = await model.generateContent('Say "Hello" in Korean. Reply with just one word.');
      const response = await result.response;
      const text = response.text();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...status,
          geminiTest: 'SUCCESS',
          geminiResponse: text.substring(0, 100),
        }),
      };
    } catch (error) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...status,
          geminiTest: 'FAILED',
          geminiError: error.message,
        }),
      };
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(status),
  };
}
