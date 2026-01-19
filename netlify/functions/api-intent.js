/**
 * Netlify Function: /api/intent
 * 사용자 의도를 분류하고 관련 패키지를 추천합니다.
 * 
 * POST /api/intent
 * Body: { "message": "로그인 기능 만들고 싶어" }
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyIntentWithGemini } from '../../backend/adapters/gemini.adapter.js';
import { searchPackages } from '../../backend/adapters/pubdev.adapter.js';
import { createLogger } from '../../backend/utils/logger.js';
import { ALLOWED_INTENTS, ALLOWED_TYPES } from '../../backend/config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('API_INTENT');

// 로컬 인텐트 데이터 디렉토리
const INTENTS_DIR = path.join(__dirname, 'data/intents');

/**
 * 로컬 인텐트 데이터 로드
 */
async function loadIntentData(intent) {
    try {
        const filePath = path.join(INTENTS_DIR, `${intent}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.packages || [];
    } catch (error) {
        logger.warn('Failed to load intent data', { intent, error: error.message });
        return [];
    }
}

/**
 * 분류 결과 정규화
 */
function normalizeClassification(raw) {
    const type = ALLOWED_TYPES.includes(raw?.type) ? raw.type : 'clarify';
    const intent = ALLOWED_INTENTS.includes(raw?.intent) ? raw.intent : 'auth_basic';
    const packageName = raw?.packageName || null;

    return { type, intent, packageName };
}

export async function handler(event) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { message } = JSON.parse(event.body || '{}');

        if (!message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Message is required' }),
            };
        }

        logger.info('Intent request received', { message });

        // 1. Gemini로 의도 분류
        const classification = await classifyIntentWithGemini(message);
        const { geminiRaw } = classification;

        // 2. 분류 결과 정규화
        let { type, intent, packageName } = normalizeClassification(classification);

        // 3. 키워드 기반 인텐트 보정 (기존 로직 유지)
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('google') || lowerMsg.includes('구글') || lowerMsg.includes('firebase') || lowerMsg.includes('파이어베이스')) {
            intent = 'firebase';
        } else if (lowerMsg.includes('kakao') || lowerMsg.includes('카카오') || lowerMsg.includes('naver') || lowerMsg.includes('네이버') || lowerMsg.includes('apple') || lowerMsg.includes('애플')) {
            intent = 'firebase';
        } else if (lowerMsg.includes('map') || lowerMsg.includes('지도')) {
            intent = 'device';
        } else if (lowerMsg.includes('video') || lowerMsg.includes('비디오') || lowerMsg.includes('동영상') || lowerMsg.includes('camera') || lowerMsg.includes('카메라') || lowerMsg.includes('audio') || lowerMsg.includes('오디오')) {
            intent = 'media';
        } else if (lowerMsg.includes('db') || lowerMsg.includes('저장') || lowerMsg.includes('database') || lowerMsg.includes('sql') || lowerMsg.includes('hive')) {
            intent = 'storage';
        } else if (lowerMsg.includes('디자인') || lowerMsg.includes('design') || lowerMsg.includes('애니메이션') || lowerMsg.includes('animation') || lowerMsg.includes('이모지')) {
            intent = 'ui_design';
        }

        // 4. feature_request 타입 처리
        if (type === 'feature_request') {
            // 로컬 큐레이션 데이터 로드
            const curatedPackages = await loadIntentData(intent);

            // 실시간 검색 (필요 시)
            let searchedPackages = [];
            const shouldSearchOnline = curatedPackages.length < 3 || lowerMsg.length > 5;

            if (shouldSearchOnline) {
                logger.info('Performing online search', { message });
                searchedPackages = await searchPackages(message, 5);
            }

            // 결과 병합 및 중복 제거
            const combined = [...curatedPackages];
            const curatedIds = new Set(curatedPackages.map((p) => p.id));

            for (const p of searchedPackages) {
                if (!curatedIds.has(p.id)) {
                    combined.push(p);
                }
            }

            // 정렬 (키워드 매칭 우선, 큐레이션 우선, 품질 점수 순)
            const finalPackages = combined
                .sort((a, b) => {
                    const aMatch = lowerMsg.includes(a.id.toLowerCase()) || (a.name && lowerMsg.includes(a.name.toLowerCase()));
                    const bMatch = lowerMsg.includes(b.id.toLowerCase()) || (b.name && lowerMsg.includes(b.name.toLowerCase()));
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;

                    const aIsCurated = curatedIds.has(a.id);
                    const bIsCurated = curatedIds.has(b.id);
                    if (aIsCurated && !bIsCurated) return -1;
                    if (!aIsCurated && bIsCurated) return 1;

                    return 0;
                })
                .slice(0, 10);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    type,
                    intent,
                    source: searchedPackages.length > 0 ? 'hybrid' : 'curated',
                    packages: finalPackages,
                    geminiRaw,
                    status: { ai: 'connected', data: 'ready' },
                }),
            };
        }

        // 5. package_query 타입 처리
        if (type === 'package_query' && packageName) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    type,
                    intent,
                    packageName,
                    source: 'ai',
                    packages: [
                        {
                            id: packageName,
                            name: packageName,
                            description: `가이드 보기: ${packageName}`,
                        },
                    ],
                    geminiRaw,
                    status: { ai: 'connected', data: 'ready' },
                }),
            };
        }

        // 6. 기타 타입 처리
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                type,
                intent,
                source: 'ai',
                packages: [],
                geminiRaw,
                status: { ai: 'connected', data: 'ready' },
            }),
        };
    } catch (error) {
        logger.error('Intent classification failed', { error: error.message });

        // Fallback
        try {
            const fallbackPackages = await loadIntentData('auth_basic');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    type: 'feature_request',
                    intent: 'auth_basic',
                    source: 'fallback_error',
                    packages: fallbackPackages,
                    status: { ai: 'error', data: 'fallback' },
                }),
            };
        } catch (fallbackError) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Internal server error' }),
            };
        }
    }
}
