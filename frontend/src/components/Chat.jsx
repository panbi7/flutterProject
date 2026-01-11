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
      // 백엔드 API 호출 (Gemini 분류 + 패키지 추천)
      const resp = await postIntent(text)
      const { type, intent, source, packages = [], packageName, geminiRaw } = resp || {}
      const isFeature = type === 'feature_request'
      const isPackageQuery = type === 'package_query'

      const fallbackType = type || 'clarify'
      const nonFeatureMessages = {
        followup_question: '조금 더 구체적으로 어떤 기능이 필요한지 알려주시면 도와드릴게요! 😊',
        smalltalk: '안녕하세요! Flutter 관련 질문이 있다면 말씀해 주세요. 🚀',
        clarify: '어떤 Flutter 기능을 구현하고 싶은지 조금 더 자세히 설명해 주실 수 있을까요? 🤔',
        package_query: packageName
          ? `📦 "${packageName}" 패키지에 대한 가이드를 찾았습니다! 아래 "구현 가이드" 버튼을 클릭해서 확인하세요.`
          : '어떤 패키지에 대해 알고 싶으신가요? 패키지 이름을 말씀해 주세요.',
      }

      const featureMessages = {
        auth_social: '소셜 로그인을 구현하시려면 아래 패키지를 추천드립니다! 🔐',
        auth_korea: '한국 로그인 서비스를 구현하시려면 아래 패키지를 추천드립니다! 🇰🇷',
        auth_quick_start: '빠르게 로그인 기능을 구현하시려면 아래 패키지를 추천드립니다! ⚡',
        auth_secure: '보안이 중요한 인증을 구현하시려면 아래 패키지를 추천드립니다! 🔒',
        auth_custom: '커스텀 백엔드 인증을 구현하시려면 아래 패키지를 추천드립니다! 🛠️',
        auth_basic: '로그인 기능을 구현하시려면 아래 패키지를 추천드립니다! 🔑',
        map: '지도 기능을 구현하시려면 아래 패키지를 추천드립니다! 🗺️',
      }

      const botMsg = {
        role: 'assistant',
        text: isFeature
          ? featureMessages[intent] || `${intent} 관련 패키지를 추천드립니다!`
          : nonFeatureMessages[fallbackType] || nonFeatureMessages.clarify,
      }
      setMessages((prev) => [...prev, botMsg])

      // 패키지 목록 설정
      if (isFeature) {
        setLatestPackages(packages)
      } else if (isPackageQuery && packageName) {
        // 패키지 직접 질문: packageName을 카드로 표시
        setLatestPackages([
          {
            id: packageName,
            name: packageName,
            pub_url: `https://pub.dev/packages/${packageName}`,
            category: 'package',
            description_ko: `${packageName} 패키지`,
          }
        ])
      } else {
        setLatestPackages([])
      }
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
