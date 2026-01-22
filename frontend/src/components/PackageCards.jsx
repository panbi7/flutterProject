import React, { useState } from 'react'
import GuideModal from './GuideModal'
import { getGuide } from '../services/guideApi'
import './PackageCards.css'

export default function PackageCards({ packages }) {
  const [selectedGuide, setSelectedGuide] = useState(null)
  const [loadingGuide, setLoadingGuide] = useState(null)

  const handleShowGuide = async (packageId) => {
    setLoadingGuide(packageId)
    try {
      const resp = await getGuide(packageId)
      if (resp.success) {
        setSelectedGuide(resp.guide)
      } else {
        console.error('[Guide API Error]', resp)
        // 상세 오류 메시지 조합
        let errorDetail = resp.error || '알 수 없는 오류'
        if (resp.serverMessage) {
          errorDetail += `\n\n[서버 응답]\n${resp.serverMessage}`
        }
        if (resp.errorType) {
          errorDetail += `\n\n[오류 타입] ${resp.errorType}`
        }
        if (resp.trace) {
          errorDetail += `\n\n[스택 트레이스]\n${resp.trace.join('\n')}`
        }
        alert(`가이드를 불러올 수 없습니다:\n\n${errorDetail}`)
      }
    } catch (error) {
      console.error('Guide loading process error:', error)
      alert(`가이드 로드 중 예기치 못한 오류가 발생했습니다: ${error.message}`)
    } finally {
      setLoadingGuide(null)
    }
  }

  const handleCloseGuide = () => {
    setSelectedGuide(null)
  }

  const getPlatforms = (apiTags) => {
    if (!apiTags) return []
    const platforms = []
    if (apiTags.includes('platform:android')) platforms.push('Android')
    if (apiTags.includes('platform:ios')) platforms.push('iOS')
    if (apiTags.includes('platform:web')) platforms.push('Web')
    if (apiTags.includes('platform:macos')) platforms.push('macOS')
    if (apiTags.includes('platform:windows')) platforms.push('Windows')
    if (apiTags.includes('platform:linux')) platforms.push('Linux')
    return platforms
  }

  if (!packages || packages.length === 0) return null

  return (
    <>
      <div className="cards">
        {packages.map((p) => {
          const platforms = getPlatforms(p.apiTags)
          return (
            <div key={p.id} className="card">
              <div className="card-header">
                <div className="package-name">{p.id}</div>
                <div className="score-pills">
                  {p.score?.likes !== undefined && (
                    <div className="score-pill likes">👍 {p.score.likes}</div>
                  )}
                  {p.githubInfo?.stars !== undefined && (
                    <div className="score-pill stars">⭐ {p.githubInfo.stars}</div>
                  )}
                </div>
              </div>

              <div className="package-description">
                {p.description?.trim() || `${p.id} Flutter 패키지`}
              </div>

              {platforms.length > 0 && (
                <div className="platform-list">
                  {platforms.map(plat => (
                    <span key={plat} className="platform-badge">{plat}</span>
                  ))}
                </div>
              )}

              <div className="package-meta">
                <span>{p.maintenance?.lastUpdated_pub ? `업데이트: ${p.maintenance.lastUpdated_pub}` : ''}</span>
                <span>{p.score?.pubPoints ? `${p.score.pubPoints} pts` : ''}</span>
              </div>

              <div className="package-footer-btns">
                {p.pub_url || p.url ? (
                  <a
                    href={p.pub_url || p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    🔗 상세정보
                  </a>
                ) : null}
                <button
                  onClick={() => handleShowGuide(p.id)}
                  disabled={loadingGuide === p.id}
                  className="btn-primary"
                >
                  {loadingGuide === p.id ? '⏳ 생성중...' : '📖 구현 가이드'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 가이드 모달 */}
      {selectedGuide && (
        <GuideModal guide={selectedGuide} onClose={handleCloseGuide} />
      )}
    </>
  )
}
