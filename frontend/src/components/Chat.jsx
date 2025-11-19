import React, { useRef, useState, useEffect } from 'react'
import MessageList from './MessageList.jsx'
import MessageInput from './MessageInput.jsx'
import PackageCards from './PackageCards.jsx'
import { classifyWithGemini } from '../services/gemini.js'

// Intent별 패키지 매핑 (백엔드 없이 프론트엔드에서 처리)
const INTENT_PACKAGES = {
  auth_basic: [
    {
      id: 'firebase_auth',
      name: 'firebase_auth',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/firebase_auth',
      description_ko: 'Firebase에서 제공하는 강력한 인증 솔루션',
      difficulty: '쉬움',
      setup_time: '15-30분',
      pros: ['설정이 간단하고 빠름', '이메일, 전화번호, 소셜 로그인 모두 지원'],
      cons: ['Firebase에 종속됨'],
      best_for: ['빠르게 프로토타입 만들기'],
    },
  ],
  auth_social: [
    {
      id: 'google_sign_in',
      name: 'google_sign_in',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/google_sign_in',
      description_ko: 'Google 계정으로 간편하게 로그인',
      difficulty: '쉬움',
      setup_time: '20-30분',
    },
  ],
  auth_korea: [
    {
      id: 'kakao_flutter_sdk',
      name: 'kakao_flutter_sdk',
      category: 'auth',
      pub_url: 'https://pub.dev/packages/kakao_flutter_sdk',
      description_ko: '카카오톡 계정으로 간편 로그인',
      difficulty: '보통',
      setup_time: '25-35분',
    },
  ],
  map: [
    {
      id: 'flutter_map',
      name: 'flutter_map',
      category: 'map',
      pub_url: 'https://pub.dev/packages/flutter_map',
      description_ko: 'Flutter용 오픈소스 지도 라이브러리',
    },
  ],
}

function getPackagesByIntent(intent) {
  return INTENT_PACKAGES[intent] || []
}

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
      // 프론트엔드에서 직접 Gemini API 호출
      const resp = await classifyWithGemini(text)
      const { type, intent, source, geminiRaw } = resp || {}

      // 패키지 데이터는 하드코딩 (백엔드 없음)
      const packages = getPackagesByIntent(intent)
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
