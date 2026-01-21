import React, { useState, useEffect } from 'react'
import { getHomeData } from '../services/homeApi'
import { getGuide } from '../services/guideApi'
import GuideModal from './GuideModal'
import './HomePage.css'

export default function HomePage({ onCategoryClick, onPackageSearch }) {
  const [homeData, setHomeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('likes') // 'likes' | 'popularity'
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [selectedGuide, setSelectedGuide] = useState(null)
  const [loadingGuide, setLoadingGuide] = useState(null)

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    setLoading(true)
    setError(null)
    console.log('[HomePage] 홈 데이터 로드 시작')
    try {
      const data = await getHomeData()
      console.log('[HomePage] 받은 데이터:', data)
      if (data) {
        setHomeData(data)
        console.log('[HomePage] 데이터 설정 완료')
      } else {
        const errorMsg = '데이터를 불러올 수 없습니다'
        console.error('[HomePage]', errorMsg)
        setError(errorMsg)
      }
    } catch (e) {
      console.error('[HomePage] 예외 발생:', {
        message: e.message,
        stack: e.stack
      })
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleShowGuide = async (packageId) => {
    console.log('[HomePage] 가이드 요청:', packageId)
    setLoadingGuide(packageId)
    try {
      const resp = await getGuide(packageId)
      console.log('[HomePage] 가이드 응답:', resp)

      if (resp.success && resp.guide) {
        setSelectedGuide(resp.guide)
      } else {
        // 상세 오류 메시지 조합
        let errorDetail = resp.error || '가이드 생성에 실패했습니다.'
        if (resp.serverMessage) {
          errorDetail += `\n\n[서버 응답]\n${resp.serverMessage}`
        }
        if (resp.errorType) {
          errorDetail += `\n\n[오류 타입] ${resp.errorType}`
        }
        if (resp.trace) {
          errorDetail += `\n\n[스택 트레이스]\n${resp.trace.join('\n')}`
        }
        console.error('[HomePage] 가이드 실패:', { packageId, error: errorDetail, response: resp })
        alert(`가이드 오류:\n\n${errorDetail}`)
      }
    } catch (error) {
      console.error('[HomePage] 가이드 로드 중 예외:', {
        packageId,
        error: error.message,
        stack: error.stack
      })
      alert(`네트워크 오류: ${error.message}`)
    } finally {
      setLoadingGuide(null)
    }
  }

  if (loading) {
    return (
      <div className="home-loading">
        <div className="loading-spinner"></div>
        <p>패키지 데이터 로딩 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-error">
        <p>{error}</p>
        <button onClick={loadHomeData}>다시 시도</button>
      </div>
    )
  }

  if (!homeData) return null

  const { monthlyWidgets, topByLikes, topByPopularity, recentlyUpdated, stats, tagCloud, quickCategories, lastUpdated } = homeData

  // 플랫폼 필터링
  const filterByPlatform = (packages) => {
    if (selectedPlatform === 'all') return packages
    return packages.filter(p => p.platforms?.includes(selectedPlatform))
  }

  const topPackages = activeTab === 'likes' ? topByLikes : topByPopularity

  return (
    <div className="home-page">
      {/* 통계 대시보드 */}
      <section className="stats-dashboard">
        <div className="stat-card">
          <div className="stat-value">{stats.totalPackages?.toLocaleString()}</div>
          <div className="stat-label">총 패키지</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(stats.totalLikes / 1000).toFixed(1)}K</div>
          <div className="stat-label">총 Likes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.avgPubPoints}</div>
          <div className="stat-label">평균 Pub Points</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.flutterFavorites || 0}</div>
          <div className="stat-label">Flutter Favorites</div>
        </div>
      </section>
      {lastUpdated && (
        <div className="data-updated">
          데이터 업데이트: {new Date(lastUpdated).toLocaleDateString('ko-KR')}
        </div>
      )}

      {/* 빠른 기능 찾기 */}
      <section className="quick-categories">
        <h2 className="section-title">빠른 기능 찾기</h2>
        <div className="category-grid">
          {quickCategories.map(cat => (
            <button
              key={cat.id}
              className="category-btn"
              style={{ '--cat-color': cat.color }}
              onClick={() => onCategoryClick?.(cat.id, cat.label)}
            >
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-label">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 이달의 위젯 */}
      <section className="monthly-widgets">
        <h2 className="section-title">
          <span className="title-icon">🌟</span>
          이달의 추천 패키지
        </h2>
        <div className="widget-cards">
          {monthlyWidgets.map(widget => (
            <div key={widget.id} className="widget-card">
              <h3 className="widget-name">{widget.name}</h3>
              <p className="widget-desc">{widget.description}</p>
              <div className="widget-stats">
                <span className="widget-stat">👍 {widget.likes.toLocaleString()}</span>
              </div>
              <div className="widget-platforms">
                {widget.platforms?.slice(0, 4).map(p => (
                  <span key={p} className="platform-chip">{p}</span>
                ))}
              </div>
              <div className="widget-actions">
                <a href={widget.pub_url} target="_blank" rel="noreferrer" className="btn-link">
                  pub.dev
                </a>
                <button
                  onClick={() => handleShowGuide(widget.id)}
                  disabled={loadingGuide === widget.id}
                  className="btn-guide"
                >
                  {loadingGuide === widget.id ? '생성중...' : '구현 가이드'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 플랫폼 필터 */}
      <section className="platform-filter">
        <h2 className="section-title">플랫폼별 보기</h2>
        <div className="platform-tabs">
          {[
            { id: 'all', label: '전체', icon: '📦' },
            { id: 'Android', label: 'Android', icon: '🤖' },
            { id: 'iOS', label: 'iOS', icon: '🍎' },
            { id: 'Web', label: 'Web', icon: '🌐' },
            { id: 'macOS', label: 'macOS', icon: '💻' },
            { id: 'Windows', label: 'Windows', icon: '🪟' },
            { id: 'Linux', label: 'Linux', icon: '🐧' },
          ].map(plat => (
            <button
              key={plat.id}
              className={`platform-tab ${selectedPlatform === plat.id ? 'active' : ''}`}
              onClick={() => setSelectedPlatform(plat.id)}
            >
              <span>{plat.icon}</span>
              <span>{plat.label}</span>
              {plat.id !== 'all' && stats.platforms && (
                <span className="platform-count">
                  {stats.platforms[plat.id.toLowerCase()] || 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 인기 패키지 TOP 10 */}
      <section className="top-packages">
        <div className="section-header">
          <h2 className="section-title">
            <span className="title-icon">🔥</span>
            인기 패키지 TOP 10
          </h2>
          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeTab === 'likes' ? 'active' : ''}`}
              onClick={() => setActiveTab('likes')}
            >
              👍 Likes
            </button>
          </div>
        </div>
        <div className="package-list">
          {filterByPlatform(topPackages || []).map((pkg, idx) => (
            <div key={pkg.id} className="package-item">
              <div className="package-rank">#{idx + 1}</div>
              <div className="package-info">
                <div className="package-name-row">
                  <span className="package-name">{pkg.name}</span>
                </div>
                <p className="package-desc">{pkg.description}</p>
                <div className="package-meta">
                  <span>👍 {pkg.likes.toLocaleString()}</span>
                  <span className="pub-points">{pkg.pubPoints} pts</span>
                </div>
              </div>
              <div className="package-actions">
                <button
                  onClick={() => handleShowGuide(pkg.id)}
                  disabled={loadingGuide === pkg.id}
                  className="btn-sm"
                >
                  {loadingGuide === pkg.id ? '...' : '가이드'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 업데이트 */}
      <section className="recent-updates">
        <h2 className="section-title">
          <span className="title-icon">🆕</span>
          최근 업데이트
        </h2>
        <div className="update-grid">
          {recentlyUpdated.map(pkg => (
            <div key={pkg.id} className="update-card">
              <div className="update-date">{pkg.lastUpdate}</div>
              <h4 className="update-name">{pkg.name}</h4>
              <p className="update-desc">{pkg.description}</p>
              <div className="update-stats">
                <span>👍 {pkg.likes.toLocaleString()}</span>
              </div>
              <button
                onClick={() => handleShowGuide(pkg.id)}
                disabled={loadingGuide === pkg.id}
                className="btn-update-guide"
              >
                {loadingGuide === pkg.id ? '생성중...' : '가이드 보기'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 태그 클라우드 */}
      <section className="tag-cloud">
        <h2 className="section-title">
          <span className="title-icon">🏷️</span>
          인기 태그
        </h2>
        <div className="tags-container">
          {tagCloud.map(({ tag, count }) => (
            <button
              key={tag}
              className="tag-chip"
              style={{ '--tag-size': Math.min(1 + count / 20, 1.5) }}
              onClick={() => onPackageSearch?.(tag)}
            >
              {tag}
              <span className="tag-count">{count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 가이드 모달 */}
      {selectedGuide && (
        <GuideModal guide={selectedGuide} onClose={() => setSelectedGuide(null)} />
      )}
    </div>
  )
}
