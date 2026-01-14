import React, { useState } from 'react'
import GuideModal from './GuideModal'
import { getGuide } from '../services/guideApi'

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
        alert(resp.error || '가이드를 불러올 수 없습니다.')
      }
    } catch (error) {
      console.error('Guide loading error:', error)
      alert('가이드를 불러오거나 생성하는 중 오류가 발생했습니다.')
    } finally {
      setLoadingGuide(null)
    }
  }

  const handleCloseGuide = () => {
    setSelectedGuide(null)
  }

  if (!packages || packages.length === 0) return null

  return (
    <>
      <div className="cards">
        {packages.map((p) => (
          <div key={p.id} className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{p.name || p.id}</div>
            {p.pub_url ? (
              <div style={{ marginBottom: 6 }}>
                <a href={p.pub_url} target="_blank" rel="noreferrer" title={p.pub_url}>{p.pub_url}</a>
              </div>
            ) : (
              <div className="muted" style={{ marginBottom: 6 }}>pub.dev 링크 없음</div>
            )}
            <div className="muted">카테고리: {p.category || 'N/A'}</div>
            {p.notes && <div className="muted">비고: {p.notes}</div>}

            {/* 버튼 영역 */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '12px'
            }}>
              {p.pub_url && (
                <a
                  href={p.pub_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.background = 'white'}
                >
                  🔗 홈페이지
                </a>
              )}
              <button
                onClick={() => handleShowGuide(p.id)}
                disabled={loadingGuide === p.id}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: loadingGuide === p.id ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                  background: loadingGuide === p.id ? '#9ca3af' : '#667eea',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  if (loadingGuide !== p.id) {
                    e.target.style.background = '#5568d3'
                  }
                }}
                onMouseLeave={(e) => {
                  if (loadingGuide !== p.id) {
                    e.target.style.background = '#667eea'
                  }
                }}
              >
                {loadingGuide === p.id ? '⏳ AI 가이드 생성 중...' : '📖 구현 가이드'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 가이드 모달 */}
      {selectedGuide && (
        <GuideModal guide={selectedGuide} onClose={handleCloseGuide} />
      )}
    </>
  )
}
