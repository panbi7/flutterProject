import React, { useState } from 'react'
import Chat from './components/Chat.jsx'

// 하드코딩된 이달의 위젯 데이터 (auth_basic.json의 상위 3개)
const MONTHLY_WIDGETS = [
  {
    id: "firebase_auth",
    name: "firebase_auth",
    pub_url: "https://pub.dev/packages/firebase_auth",
    description_ko: "Firebase에서 제공하는 강력한 인증 솔루션",
    difficulty: "쉬움",
    setup_time: "15-30분",
    popularity: "매우 높음"
  },
  {
    id: "flutter_secure_storage",
    name: "flutter_secure_storage",
    pub_url: "https://pub.dev/packages/flutter_secure_storage",
    description_ko: "토큰, 비밀번호 등 민감한 데이터를 안전하게 저장",
    difficulty: "쉬움",
    setup_time: "5-10분",
    popularity: "높음"
  },
  {
    id: "supabase_auth",
    name: "supabase_flutter",
    pub_url: "https://pub.dev/packages/supabase_flutter",
    description_ko: "오픈소스 Firebase 대안, 강력한 인증과 DB 제공",
    difficulty: "보통",
    setup_time: "20-40분",
    popularity: "증가 중"
  }
]

export default function App() {
  const [isWidgetDropdownOpen, setIsWidgetDropdownOpen] = useState(false)

  return (
    <div className="container">
      <div className="header">
        <div className="title">Flutter 오픈소스 스타터킷 Web</div>
        <div style={{ position: 'relative' }}>
          <button
            className="widget-dropdown-btn"
            onClick={() => setIsWidgetDropdownOpen(!isWidgetDropdownOpen)}
          >
            이달의 위젯 ▼
          </button>
          {isWidgetDropdownOpen && (
            <div className="widget-dropdown-content">
              {MONTHLY_WIDGETS.map((widget) => (
                <a
                  key={widget.id}
                  href={widget.pub_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="widget-card-item"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <h3 className="widget-name">{widget.name}</h3>
                  <p className="widget-description">{widget.description_ko}</p>
                  <div className="widget-info">
                    <span className="badge">난이도: {widget.difficulty}</span>
                    <span className="badge">설정: {widget.setup_time}</span>
                    <span className="badge">인기도: {widget.popularity}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="chat-wrapper">
        <Chat />
      </div>
    </div>
  )
}

