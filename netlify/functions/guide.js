// Netlify Function for guide API
// 프로덕션 배포용

// 가이드 데이터를 직접 임베드 (파일 시스템 접근 불가)
const GUIDES = {
  firebase_auth: require('../../backend/data/examples/firebase_auth.json')
};

exports.handler = async (event, context) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // GET 요청만 허용
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Query 파라미터에서 packageId 추출
  const packageId = event.queryStringParameters?.packageId;

  if (!packageId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'packageId 파라미터가 필요합니다.'
      })
    };
  }

  // 가이드 조회
  const guide = GUIDES[packageId];

  if (!guide) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: `'${packageId}' 가이드를 찾을 수 없습니다.`,
        fallback: {
          message: 'pub.dev에서 공식 문서를 확인해주세요.',
          url: `https://pub.dev/packages/${packageId}`
        }
      })
    };
  }

  // 성공 응답
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      guide
    })
  };
};
