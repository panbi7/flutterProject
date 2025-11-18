import React, { useState } from 'react'

export default function MessageInput({ onSend }) {
  const [value, setValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const v = value
    setValue('')
    onSend?.(v)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, width: '100%' }}>
      <input
        className="input"
        type="text"
        placeholder="원하는 Flutter 기능을 입력하세요..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="btn" type="submit">전송</button>
    </form>
  )
}

