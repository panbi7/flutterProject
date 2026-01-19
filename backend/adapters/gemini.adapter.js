import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '../utils/logger.js';
import { ENV, validateEnv } from '../config/env.js';
import { GEMINI_CONFIG } from '../config/constants.js';

const logger = createLogger('GEMINI_ADAPTER');

let genAI = null;
let model = null;

/**
 * Gemini API 초기화
 */
function initializeGemini() {
    if (!genAI && ENV.GEMINI_API_KEY) {
        try {
            validateEnv();
            genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
            model = genAI.getGenerativeModel({ model: ENV.GEMINI_MODEL });
            logger.info('Gemini API initialized', { model: ENV.GEMINI_MODEL });
        } catch (error) {
            logger.error('Failed to initialize Gemini API', { error: error.message });
            throw error;
        }
    } else if (!ENV.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
    }
}

/**
 * 가이드 생성용 Gemini 호출
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function generateGuideWithGemini(prompt) {
    try {
        initializeGemini();

        if (!model) {
            throw new Error('Gemini model not initialized');
        }

        logger.debug('Generating guide with Gemini', {
            promptLength: prompt.length,
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: GEMINI_CONFIG.GUIDE_GENERATION,
        });

        const response = await result.response;
        const text = response.text();

        logger.info('Guide generated successfully', {
            responseLength: text.length,
        });

        return text;
    } catch (error) {
        logger.error('Failed to generate guide', { error: error.message });
        throw error;
    }
}

/**
 * 인텐트 분류용 Gemini 호출
 * @param {string} userMessage
 * @returns {Promise<Object>}
 */
export async function classifyIntentWithGemini(userMessage) {
    try {
        initializeGemini();

        if (!model) {
            throw new Error('Gemini model not initialized');
        }

        const prompt = createIntentClassificationPrompt(userMessage);

        logger.debug('Classifying intent with Gemini', {
            messageLength: userMessage.length,
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: GEMINI_CONFIG.INTENT_CLASSIFICATION,
        });

        const response = await result.response;
        const text = response.text();

        logger.debug('Intent classification response', { response: text });

        // JSON 추출 및 파싱
        const match = text.match(/\{.*\}/s);
        if (match) {
            const parsed = JSON.parse(match[0]);
            logger.info('Intent classified successfully', parsed);
            return {
                type: parsed.type || 'clarify',
                intent: parsed.intent || 'auth_basic',
                packageName: parsed.packageName || null,
                geminiRaw: text,
            };
        }

        logger.warn('No valid JSON found in response', { response: text });
        return {
            type: 'clarify',
            intent: 'auth_basic',
            packageName: null,
            geminiRaw: text,
        };
    } catch (error) {
        logger.error('Failed to classify intent', { error: error.message });
        throw error;
    }
}

/**
 * 인텐트 분류 프롬프트 생성
 */
function createIntentClassificationPrompt(userMessage) {
    return `Classify the following user message into type and intent. You MUST return ONLY a valid JSON object.

User message: "${userMessage}"

CLASSIFICATION RULES:

1. TYPE (choose exactly one):
   - "smalltalk" = Greetings, thanks, casual chat (안녕, 고마워, hi, hello, 잘가, 반가워)
   - "feature_request" = Wants to implement a Flutter feature (로그인 만들고 싶어, 지도 보여줘, 결제 붙이고 싶어)
   - "package_query" = Asks for usage, examples, or guides for a specific package (flutter_bloc 어떻게 써?, dio 사용법, provider 예제 보여줘)
   - "followup_question" = Follow-up question about a previous answer
   - "clarify" = Unclear or ambiguous message

2. INTENT (choose exactly one):
   - "firebase" = Firebase services (파이어베이스, auth, firestore, analytics, messaging, crashlytics, remote config)
   - "state_management" = State management (상태 관리, 공유, provider, bloc, riverpod, getx, signals)
   - "network_http" = Network/API (네트워크, http, api, 통신, dio, shelf, connectivity)
   - "storage" = Database/Storage (데이터 저장, db, 로컬 저장소, sqlite, sqflite, hive, drift, shared_preferences, secure storage)
   - "media" = Media/Video/Audio/Camera (비디오, 동영상, 오디오, 음악, 카메라, 사진, video, audio, camera, player)
   - "routing" = Navigation/Routing (라우팅, 네비게이션, 화면 전환, go_router, auto_route)
   - "ui_design" = UI/Animation (디자인, 애니메이션, lottie, shimmer, icon, font awesome, badge, carousel)
   - "forms" = Forms/Input (폼, 입력, 유효성 검사, pinput, form builder)
   - "device" = Device Features/Hardware (권한, 센서, 위치, 지참, 지리, permission, geolocator, sensor, vibration)
   - "native" = Native/FFI/Desktop (네이티브 연동, ffi, win32, window manager, package info)
   - "utils" = Utilities/Helpers (유틸리티, uuid, crypto, path, logger, retry, intl, date, time)
   - "rendering" = Content Rendering (svg, html, xml, yaml, markdown, image rendering)
   - "auth_basic" = Default/fallback or general question

3. packageName:
   - If TYPE is "package_query", extract the package name (e.g., "flutter_bloc", "dio", "provider").
   - Extract the EXACT name from pub.dev if possible.
   - Otherwise, this field should be omitted.

EXAMPLES (copy the exact format):
Input: "파이어베이스 로그인" → Output: {"type":"feature_request","intent":"firebase"}
Input: "상태 관리 패키지 추천" → Output: {"type":"feature_request","intent":"state_management"}
Input: "dio 사용법" → Output: {"type":"package_query","intent":"network_http","packageName":"dio"}
Input: "로컬 DB 쓰고 싶어" → Output: {"type":"feature_request","intent":"storage"}

NOW CLASSIFY: "${userMessage}"

Return format: {"type":"...","intent":"...","packageName":"..."}
(The "packageName" key is ONLY included when the type is "package_query")
NO explanation, NO markdown, ONLY JSON:`;
}
