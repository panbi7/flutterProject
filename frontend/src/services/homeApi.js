/**
 * 홈페이지 데이터 API 클라이언트
 *
 * 정적 JSON 파일에서 데이터를 로드합니다.
 * 데이터는 GitHub Actions를 통해 월 1회 자동 업데이트됩니다.
 */

// 캐시
let cachedData = null;
let cachedMeta = null;

/**
 * 메타 정보 가져오기 (통계, 카테고리 등)
 */
export async function getMeta() {
  if (cachedMeta) return cachedMeta;

  try {
    const res = await fetch('/data/meta.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedMeta = await res.json();
    return cachedMeta;
  } catch (error) {
    console.error('[HomeAPI] 메타 데이터 로드 실패:', error);
    return null;
  }
}

/**
 * 상위 100개 패키지 가져오기
 */
export async function getTop100() {
  try {
    const res = await fetch('/data/top-100.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[HomeAPI] Top 100 로드 실패:', error);
    return null;
  }
}

/**
 * 월별 추천 패키지 가져오기
 */
export async function getMonthlyWidgets() {
  try {
    const res = await fetch('/data/monthly-widgets.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[HomeAPI] Monthly widgets 로드 실패:', error);
    return null;
  }
}

/**
 * 홈페이지 전체 데이터 가져오기 (기존 API 호환)
 *
 * 반환 형식:
 * {
 *   monthlyWidgets: [...],
 *   topByLikes: [...],
 *   topByPopularity: [...],
 *   recentlyUpdated: [...],
 *   stats: {...},
 *   tagCloud: [...],
 *   quickCategories: [...]
 * }
 */
export async function getHomeData() {
  console.log('[HomeAPI] 정적 데이터 로드 시작');

  try {
    // 병렬로 데이터 로드
    const [meta, top100, monthlyWidgets] = await Promise.all([
      getMeta(),
      getTop100(),
      getMonthlyWidgets(),
    ]);

    if (!meta || !top100) {
      console.error('[HomeAPI] 필수 데이터 로드 실패');
      // 폴백: 기존 API 호출 시도
      return await fetchFromApi();
    }

    // 기존 API 응답 형식에 맞게 변환
    const data = {
      // 월별 추천 패키지 (월별 위젯 또는 인기 패키지에서)
      monthlyWidgets: (monthlyWidgets || top100.byLikes.slice(0, 20)).map(pkg => ({
        id: pkg.name,
        name: pkg.name,
        description: pkg.description || '',
        likes: pkg.likes || 0,
        popularity: pkg.popularity || 0,
        pubPoints: pkg.pubPoints || 0,
        platforms: pkg.platforms || [],
        pub_url: `https://pub.dev/packages/${pkg.name}`,
        isFlutterFavorite: pkg.isFlutterFavorite || false,
      })),

      // 인기 패키지 (Likes 기준)
      topByLikes: top100.byLikes.slice(0, 10).map(pkg => ({
        id: pkg.name,
        name: pkg.name,
        description: pkg.description || '',
        likes: pkg.likes || 0,
        popularity: pkg.popularity || 0,
        pubPoints: pkg.pubPoints || 0,
        platforms: pkg.platforms || [],
      })),

      // 인기 패키지 (Popularity 기준)
      topByPopularity: top100.byPopularity.slice(0, 10).map(pkg => ({
        id: pkg.name,
        name: pkg.name,
        description: pkg.description || '',
        likes: pkg.likes || 0,
        popularity: pkg.popularity || 0,
        pubPoints: pkg.pubPoints || 0,
        platforms: pkg.platforms || [],
      })),

      // 최근 업데이트 (상위 패키지 중에서 선택)
      recentlyUpdated: top100.byLikes.slice(10, 20).map(pkg => ({
        id: pkg.name,
        name: pkg.name,
        description: pkg.description || '',
        likes: pkg.likes || 0,
        popularity: pkg.popularity || 0,
        lastUpdate: '최근',  // 정적 데이터에서는 정확한 날짜 없음
      })),

      // 통계
      stats: {
        totalPackages: meta.stats?.totalPackages || meta.totalPackages || 0,
        totalLikes: meta.stats?.totalLikes || 0,
        avgPubPoints: meta.stats?.avgPubPoints || 0,
        platforms: meta.stats?.platformCounts || {},
        flutterFavorites: meta.stats?.flutterFavorites || 0,
      },

      // 태그 클라우드
      tagCloud: meta.stats?.tagCloud || [],

      // 빠른 카테고리
      quickCategories: meta.quickCategories || getDefaultCategories(),

      // 메타 정보
      lastUpdated: meta.lastUpdated,
    };

    console.log('[HomeAPI] 데이터 로드 완료:', {
      monthlyWidgets: data.monthlyWidgets.length,
      topByLikes: data.topByLikes.length,
      totalPackages: data.stats.totalPackages,
    });

    cachedData = data;
    return data;

  } catch (error) {
    console.error('[HomeAPI] 데이터 로드 오류:', error);
    // 폴백: 기존 API 호출 시도
    return await fetchFromApi();
  }
}

/**
 * 폴백: 기존 Netlify Function API 호출
 */
async function fetchFromApi() {
  console.log('[HomeAPI] 폴백: API 호출 시도');

  try {
    const res = await fetch('/api/home-data', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      console.error('[HomeAPI] API 오류:', res.status);
      return null;
    }

    const data = await res.json();

    // API 응답 형식 처리
    if (data.success !== undefined) {
      return data.success ? data.data : null;
    }
    return data;

  } catch (error) {
    console.error('[HomeAPI] API 호출 실패:', error);
    return null;
  }
}

/**
 * 기본 카테고리 (폴백)
 */
function getDefaultCategories() {
  return [
    { id: 'auth', label: '인증', icon: '🔐', color: '#4CAF50', keywords: ['auth', 'login', 'firebase_auth', 'sign_in'] },
    { id: 'ui', label: 'UI/UX', icon: '🎨', color: '#9C27B0', keywords: ['widget', 'design', 'theme', 'color'] },
    { id: 'network', label: '네트워크', icon: '🌐', color: '#2196F3', keywords: ['http', 'dio', 'api', 'network', 'connectivity'] },
    { id: 'storage', label: '저장소', icon: '💾', color: '#FF9800', keywords: ['storage', 'database', 'cache', 'sqflite', 'shared_preferences'] },
    { id: 'media', label: '미디어', icon: '📷', color: '#E91E63', keywords: ['camera', 'video', 'audio', 'image', 'image_picker'] },
    { id: 'device', label: '디바이스', icon: '📱', color: '#00BCD4', keywords: ['device', 'sensor', 'platform', 'device_info'] },
    { id: 'state', label: '상태관리', icon: '🔄', color: '#673AB7', keywords: ['bloc', 'riverpod', 'provider', 'state', 'getx'] },
    { id: 'animation', label: '애니메이션', icon: '✨', color: '#FF5722', keywords: ['animation', 'animate', 'lottie', 'rive'] },
    { id: 'firebase', label: 'Firebase', icon: '🔥', color: '#FFCA28', keywords: ['firebase', 'firestore', 'firebase_auth'] },
    { id: 'map', label: '지도', icon: '🗺️', color: '#009688', keywords: ['map', 'google_maps', 'location', 'geolocator'] },
    { id: 'chart', label: '차트', icon: '📊', color: '#3F51B5', keywords: ['chart', 'graph', 'fl_chart', 'syncfusion'] },
    { id: 'notification', label: '알림', icon: '🔔', color: '#F44336', keywords: ['notification', 'push', 'local_notifications'] },
    { id: 'payment', label: '결제/광고', icon: '💳', color: '#795548', keywords: ['payment', 'purchase', 'ads', 'in_app_purchase'] },
    { id: 'qr', label: 'QR/바코드', icon: '📷', color: '#607D8B', keywords: ['qr', 'barcode', 'scanner', 'qr_flutter'] },
    { id: 'i18n', label: '다국어', icon: '🌍', color: '#8BC34A', keywords: ['localization', 'i18n', 'translation', 'easy_localization'] },
    { id: 'navigation', label: '네비게이션', icon: '🧭', color: '#03A9F4', keywords: ['router', 'navigation', 'go_router'] },
    { id: 'form', label: '폼/입력', icon: '📝', color: '#CDDC39', keywords: ['form', 'input', 'validation', 'text_field'] },
    { id: 'pdf', label: 'PDF/문서', icon: '📄', color: '#9E9E9E', keywords: ['pdf', 'document', 'printing', 'file'] },
  ];
}

/**
 * 캐시 클리어
 */
export function clearCache() {
  cachedData = null;
  cachedMeta = null;
}
