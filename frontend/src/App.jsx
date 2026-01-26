import React, { useState, useEffect } from 'react'
import Chat from './components/Chat.jsx'
import HomePage from './components/HomePage.jsx'
import { getHomeData } from './services/homeApi.js'

const ADMIN_SECRET = 'flutter-guide-admin-2024'

export default function App() {
  const [view, setView] = useState('home') // 'home' | 'chat'
  const [monthlyWidgets, setMonthlyWidgets] = useState([])
  const [isWidgetDropdownOpen, setIsWidgetDropdownOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState(null)
  const [isClearingCache, setIsClearingCache] = useState(false)

  // 이달의 위젯 동적 로드
  useEffect(() => {
    loadMonthlyWidgets()
  }, [])

  const loadMonthlyWidgets = async () => {
    try {
      const data = await getHomeData()
      if (data?.monthlyWidgets) {
        setMonthlyWidgets(data.monthlyWidgets)
      }
    } catch (e) {
      console.error('이달의 위젯 로드 실패:', e)
    }
  }

  // 카테고리 클릭 시 채팅으로 이동
  const handleCategoryClick = (categoryId, categoryLabel) => {
    const messages = {
      'auth_basic': '로그인 기능 구현하고 싶어',
      'auth_social': '소셜 로그인 붙이고 싶어',
      'map': '지도 기능 쓰고 싶어',
      'firebase': 'Firebase 연동하고 싶어',
      'storage': '데이터 저장하고 싶어',
      'ui_design': 'UI 디자인 꾸미고 싶어',
      'media': '미디어 재생 기능 넣고 싶어',
      'network_http': 'HTTP 통신하고 싶어',
      'device': '디바이스 기능 사용하고 싶어',
      'forms': '폼 입력 만들고 싶어',
      'state_management': '상태관리 하고 싶어',
      'utils': '유틸리티 기능 필요해',
    }
    setInitialMessage(messages[categoryId] || `${categoryLabel} 관련 패키지 찾아줘`)
    setView('chat')
  }

  // 태그/검색 클릭 시 채팅으로 이동
  const handlePackageSearch = (query) => {
    setInitialMessage(`${query} 관련 패키지 알려줘`)
    setView('chat')
  }

  // 캐시 초기화 핸들러
  const handleClearCache = async () => {
    const confirmed = window.confirm(
      '⚠️ 가이드 캐시 초기화\n\n' +
      '모든 패키지의 캐시된 가이드가 삭제됩니다.\n' +
      '다음 요청 시 가이드가 새로 생성됩니다.\n\n' +
      '정말 삭제하시겠습니까?'
    )

    if (!confirmed) return

    setIsClearingCache(true)
    try {
      const response = await fetch(
        `/.netlify/functions/cache-clear?all=true&secret=${ADMIN_SECRET}`
      )
      const data = await response.json()

      if (data.success) {
        alert(`✅ 캐시 초기화 완료\n\n삭제된 항목: ${data.deleted?.length || 0}개`)
      } else {
        alert(`❌ 캐시 초기화 실패\n\n${data.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      alert(`❌ 캐시 초기화 실패\n\n${error.message}`)
    } finally {
      setIsClearingCache(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
          Flutter 오픈소스 스타터킷 Web
        </div>
        <div className="header-actions">
          {/* 뷰 전환 버튼 */}
          <div className="view-toggle">
            <button
              className={`view-btn ${view === 'home' ? 'active' : ''}`}
              onClick={() => setView('home')}
            >
              홈
            </button>
            <button
              className={`view-btn ${view === 'chat' ? 'active' : ''}`}
              onClick={() => {
                setInitialMessage(null)
                setView('chat')
              }}
            >
              채팅
            </button>
          </div>

          {/* 캐시 초기화 버튼 */}
          <button
            className="cache-clear-btn"
            onClick={handleClearCache}
            disabled={isClearingCache}
            title="가이드 캐시 초기화"
          >
            {isClearingCache ? '삭제 중...' : '🗑️ 캐시 초기화'}
          </button>

          {/* 이달의 위젯 드롭다운 */}
          <div style={{ position: 'relative' }}>
            <button
              className="widget-dropdown-btn"
              onClick={() => setIsWidgetDropdownOpen(!isWidgetDropdownOpen)}
            >
              이달의 위젯 ▼
            </button>
            {isWidgetDropdownOpen && (
              <div className="widget-dropdown-content">
                {monthlyWidgets.length > 0 ? (
                  monthlyWidgets.slice(0, 5).map((widget) => (
                    <a
                      key={widget.id}
                      href={widget.pub_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="widget-card-item"
                      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                    >
                      <div className="widget-header-row">
                        <h3 className="widget-name">{widget.name}</h3>
                        {widget.isFlutterFavorite && (
                          <span className="ff-tag">Flutter Favorite</span>
                        )}
                      </div>
                      <p className="widget-description">{widget.description}</p>
                      <div className="widget-info">
                        <span className="badge">👍 {widget.likes?.toLocaleString()}</span>
                        <span className="badge">⭐ {widget.stars?.toLocaleString()}</span>
                        {widget.platforms?.slice(0, 3).map(p => (
                          <span key={p} className="badge platform">{p}</span>
                        ))}
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="widget-loading">로딩 중...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="main-content">
        {view === 'home' ? (
          <div className="home-wrapper">
            <HomePage
              onCategoryClick={handleCategoryClick}
              onPackageSearch={handlePackageSearch}
            />
          </div>
        ) : (
          <div className="chat-wrapper">
            <Chat initialMessage={initialMessage} />
          </div>
        )}
      </div>
    </div>
  )
}
