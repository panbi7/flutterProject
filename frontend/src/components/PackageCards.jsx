import React from 'react'

export default function PackageCards({ packages }) {
  if (!packages || packages.length === 0) return null
  return (
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
        </div>
      ))}
    </div>
  )
}
