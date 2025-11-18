import React from 'react'

export default function MessageList({ messages }) {
  return (
    <>
      {messages.map((m, i) => (
        <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'bot'}`}>
          {m.text}
        </div>
      ))}
    </>
  )
}

