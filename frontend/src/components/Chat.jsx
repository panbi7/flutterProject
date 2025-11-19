import React, { useRef, useState, useEffect } from 'react'
import MessageList from './MessageList.jsx'
import MessageInput from './MessageInput.jsx'
import PackageCards from './PackageCards.jsx'
import { postIntent } from '../services/api.js'

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '안녕하세요! 원하는 Flutter 기능을 물어보세요. (예: "구글 로그인 붙이고 싶어", "지도 쓰고 싶어", "결제 붙이고 싶어")',
    },
  ])
  const [loading, setLoading] = useState(false)
  const [latestPackages, setLatestPackages] = useState([])
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (text) => {
    if (!text.trim()) return
    const userMsg = { role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    try {
      const resp = await postIntent(text)
      const { type, intent, source, packages = [], geminiRaw } = resp || {}
      const isFeature = type === 'feature_request'

      const fallbackType = type || 'clarify'
      const nonFeatureMessages = {
        followup_question: '조금 더 구체적으로 어떤 기능이 필요한지 알려주시면 도와드릴게요! 😊',
        smalltalk: '안녕하세요! Flutter 관련 질문이 있다면 말씀해 주세요. 🚀',
        clarify: '어떤 Flutter 기능을 구현하고 싶은지 조금 더 자세히 설명해 주실 수 있을까요? 🤔',
      }

      const debugInfo = `\n\n📝 입력: "${text}"\n🤖 Gemini 분류: type="${type}", intent="${intent}"\n📊 처리: ${source}`
      const geminiDetails = `\n\n━━━━━━━━━━━━━━━━━━━━━━\n[GEMINI RAW 응답]\n${geminiRaw || '(응답 없음)'}\n━━━━━━━━━━━━━━━━━━━━━━`

      const botMsg = {
        role: 'assistant',
        text: isFeature
          ? `의도(intent): ${intent}${debugInfo}${geminiDetails}`
          : `${nonFeatureMessages[fallbackType] || nonFeatureMessages.clarify}${debugInfo}${geminiDetails}`,
      }
      setMessages((prev) => [...prev, botMsg])
      setLatestPackages(isFeature ? packages : [])
    } catch (e) {
      const botMsg = {
        role: 'assistant',
        text: '오류가 발생했지만 데모용 기본 응답을 반환합니다.',
      }
      setMessages((prev) => [...prev, botMsg])
      setLatestPackages([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div ref={listRef} className="messages">
        <MessageList messages={messages} />
        {Array.isArray(latestPackages) && latestPackages.length > 0 && (
          <PackageCards packages={latestPackages} />
        )}
        {loading && (
          <div className="bubble bot muted">생각 중...</div>
        )}
      </div>
      <div className="footer">
        <MessageInput onSend={handleSend} />
      </div>
    </>
  )
}
