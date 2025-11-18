import React from 'react'
import Chat from './components/Chat.jsx'

export default function App() {
  return (
    <div className="container">
      <div className="header">
        <div className="title">Flutter 오픈소스 스타터킷 Web</div>
      </div>
      <div className="chat-wrapper">
        <Chat />
      </div>
    </div>
  )
}

