import 'dotenv/config';
import { callGeminiClassifier } from './gemini.js';

const testQueries = [
    "파이어베이스로 로그인 구현하고 싶어",
    "Riverpod이나 BLoC 같은 상태 관리 알려줘",
    "Dio 패키지 사용해서 API 통신하기",
    "로컬 SQLite 데이터베이스 연동",
    "Lottie 애니메이션 넣고 싶어",
    "입력 폼 유효성 검사하는 법",
    "GPS 위치 정보 가져오고 싶어",
    "윈도우 앱 만들 때 필요한 패키지",
    "UUID 생성 유틸리티",
    "SVG 파일 화면에 보여주기",
    "비디오 플레이어 붙이기"
];

async function runTest() {
    console.log('=== New Intent Classification Test ===\n');

    for (const query of testQueries) {
        try {
            const result = await callGeminiClassifier(query);
            console.log(`Query: "${query}"`);
            console.log(`Result: { type: ${result.type}, intent: ${result.intent} }`);
            console.log('---');
        } catch (error) {
            console.error(`Error testing query "${query}":`, error.message);
        }
    }
}

runTest();
