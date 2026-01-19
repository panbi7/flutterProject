/**
 * Netlify Function: /api/search
 * 패키지 검색 API
 * 
 * GET /api/search?q=dio
 */

import { searchPackages } from '../../backend/adapters/pubdev.adapter.js';
import { searchPackageIndex } from '../../backend/services/packageIndex.service.js';
import { createLogger } from '../../backend/utils/logger.js';

const logger = createLogger('API_SEARCH');

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
        const { q } = event.queryStringParameters || {};

        if (!q) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'q query parameter is required' }),
            };
        }

        logger.info('Search request received', { query: q });

        // 1. 로컬 인덱스 검색 (빠름)
        const localResults = await searchPackageIndex(q, 5);

        // 2. pub.dev 검색 (보완)
        const onlineResults = await searchPackages(q, 5);

        // 3. 결과 병합 및 중복 제거
        const combined = [...localResults.map((name) => ({ id: name, name, source: 'local' }))];
        const localIds = new Set(localResults);

        for (const pkg of onlineResults) {
            if (!localIds.has(pkg.id)) {
                combined.push({ ...pkg, source: 'online' });
            }
        }

        logger.info('Search completed', { query: q, resultCount: combined.length });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                query: q,
                results: combined.slice(0, 10),
                count: combined.length,
            }),
        };
    } catch (error) {
        logger.error('Search failed', { error: error.message });

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Search failed',
                details: error.message,
            }),
        };
    }
}
