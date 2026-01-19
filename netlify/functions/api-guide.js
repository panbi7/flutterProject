/**
 * Netlify Function: /api/guide
 * 특정 패키지의 구현 가이드를 반환합니다.
 * 
 * GET /api/guide?packageId=dio
 */

import { generateGuide } from '../../backend/services/guideGenerator.service.js';
import { createLogger } from '../../backend/utils/logger.js';

const logger = createLogger('API_GUIDE');

export async function handler(event) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
    };

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { packageId } = event.queryStringParameters || {};

        if (!packageId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'packageId query parameter is required' }),
            };
        }

        logger.info('Guide request received', { packageId });

        // 가이드 생성 (캐시 자동 처리)
        const guide = await generateGuide(packageId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(guide),
        };
    } catch (error) {
        logger.error('Failed to generate guide', { error: error.message });

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate guide',
                details: error.message,
            }),
        };
    }
}
