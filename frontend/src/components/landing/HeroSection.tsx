import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useInView } from '../../hooks/useInView'

type Phase = 'chat' | 'after'

const TO_AFTER  = 3400  // 채팅 완료 후 after로 전환
const SHOW_CARD = 3900  // after 전환 후 카드 팝업
const RESET     = 7500
const LOOP      = 8100

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-grape-400"
          style={{ animation: `typing-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  )
}

function ChatPhone({ visible }: { visible: boolean }) {
  const [loopKey, setLoopKey] = useState(0)
  const [phase, setPhase] = useState<Phase>('chat')
  const [chatStep, setChatStep] = useState(0)
  const [showCard, setShowCard] = useState(false)

  useEffect(() => {
    if (!visible) return

    const timers: ReturnType<typeof setTimeout>[] = []

    // 채팅 시퀀스
    timers.push(setTimeout(() => setChatStep(1), 600))
    timers.push(setTimeout(() => setChatStep(2), 1100))
    timers.push(setTimeout(() => setChatStep(3), 1900))

    // chat → after (좌우 슬라이드)
    timers.push(setTimeout(() => setPhase('after'), TO_AFTER))

    // 거래 카드 팝업
    timers.push(setTimeout(() => setShowCard(true), SHOW_CARD))

    // 루프 리셋
    timers.push(setTimeout(() => {
      setPhase('chat')
      setChatStep(0)
      setShowCard(false)
    }, RESET))
    timers.push(setTimeout(() => setLoopKey((k) => k + 1), LOOP))

    return () => timers.forEach(clearTimeout)
  }, [visible, loopKey])

  const chatX  = phase === 'chat'  ? '0%'   : '-100%'
  const afterX = phase === 'after' ? '0%'   : '100%'
  const slideTransition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)'

  const screenshotStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: '-20px',
    left: 0,
    right: 0,
    objectFit: 'cover',
    objectPosition: 'top',
    width: '100%',
    height: 'calc(100% + 20px)',
  }

  return (
    <div className="relative h-[540px] w-[268px] overflow-hidden rounded-[3rem] border-[7px] border-stone-900/10 bg-white shadow-2xl md:h-[600px] md:w-[290px]">
      {/* Notch */}
      <div className="absolute left-1/2 top-[5px] z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-stone-900/10" />

      {/* ── 채팅 화면 (좌우 슬라이드) ── */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{ transform: `translateX(${chatX})`, transition: slideTransition }}
      >
        <div className="flex items-center justify-between bg-grape-600 px-5 pb-2 pt-3 text-[10px] text-white/90">
          <span className="font-semibold">9:41</span>
          <div className="flex gap-1">
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
              <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 0 0-6 0zm-4-4l2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
            </svg>
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
              <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-2 border-b border-stone-100 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-grape-100 text-base">🍇</div>
          <div>
            <p className="text-xs font-bold text-stone-800">포도 가계부 AI</p>
            <p className="text-[10px] text-emerald-500">온라인</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 overflow-hidden px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-stone-100" />
            <span className="text-[10px] text-stone-400">오늘</span>
            <div className="h-px flex-1 bg-stone-100" />
          </div>
          {chatStep >= 1 && (
            <div className="animate-bubble-in flex justify-end">
              <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-grape-600 px-3 py-2 text-xs text-white shadow-sm">
                점심 김치찌개 8000원
              </div>
            </div>
          )}
          {chatStep >= 2 && chatStep < 3 && (
            <div className="animate-bubble-in flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-stone-100 px-3 py-2">
                <TypingDots />
              </div>
            </div>
          )}
          {chatStep >= 3 && (
            <div className="animate-bubble-in flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-stone-100 px-3 py-2 text-xs leading-relaxed text-stone-700 shadow-sm">
                🍇 김치찌개 8,000원 기록했어요
                <br /><br />
                <span className="text-stone-400">3월 31일 (월) · 식비</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-stone-100 bg-white px-3 py-2.5">
          <div className="flex flex-1 items-center rounded-full bg-stone-100 px-3 py-1.5 text-[11px] text-stone-400">
            메시지 입력...
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-grape-600">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── after 화면 (좌우 슬라이드) ── */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ transform: `translateX(${afterX})`, transition: slideTransition }}
      >
        <img
          src="/screenshot-after.jpg"
          alt="김치찌개 추가된 거래 목록"
          style={screenshotStyle}
        />

        {/* 거래 카드 팝업 */}
        {showCard && (
          <div className="animate-bubble-in absolute bottom-20 left-4 right-4 z-10 rounded-2xl border border-grape-100 bg-white px-4 py-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-grape-100 text-sm">🍇</span>
                <div>
                  <p className="text-xs font-bold text-stone-800">김치찌개</p>
                  <p className="text-[10px] text-stone-400">식비 · 방금</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-rose-500">-8,000원</p>
                <p className="text-[10px] font-medium text-leaf-600">✓ 추가됐어요</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function HeroSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative min-h-screen overflow-hidden bg-cream pt-16">
      <div
        className="animate-float-glow pointer-events-none absolute"
        style={{
          top: "40%", left: "60%",
          width: 520, height: 520,
          background: "radial-gradient(circle, rgba(168,85,247,0.28) 0%, rgba(168,85,247,0.08) 55%, transparent 75%)",
          filter: "blur(80px)",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        ref={ref}
        className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center gap-10 px-4 py-16 sm:px-6 md:flex-row md:gap-16 lg:px-8"
      >
        <div
          className={`flex flex-1 flex-col items-center text-center md:items-start md:text-left ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-grape-200 bg-grape-50 px-3.5 py-1 text-xs font-medium text-grape-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-grape-500" />
            드디어 꾸준히 쓰게 되는 가계부
          </div>
          <h1
            className="text-pretty text-4xl font-extrabold leading-tight sm:text-5xl md:text-[3.5rem]"
            style={{
              background: "linear-gradient(135deg, #7e22ce 0%, #a855f7 60%, #c084fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            <span className="block">포도알처럼</span>
            <span className="block">하나씩, 알찬</span>
            <span className="block" style={{ WebkitTextFillColor: "#292524", color: "#292524" }}>
              가계부
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-stone-500 sm:text-lg">
            <span className="block">말로 기록하면</span>
            <span className="block font-semibold text-stone-700">AI가 알아서 분류하는</span>
            <span className="block">우리 집 가계부</span>
          </p>
          <Link
            to="/login"
            className="mt-8 font-bold text-white text-base shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-grape-300/60 hover:shadow-xl active:scale-95"
            style={{
              borderRadius: 32,
              background: "linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)",
              padding: "14px 36px",
              boxShadow: "0 8px 24px rgba(168,85,247,0.30)",
            }}
          >
            지금 무료로 시작하기 →
          </Link>
          <p className="mt-3 text-xs text-stone-400">신용카드 불필요 · 30초면 충분해요</p>
        </div>

        <div
          className={`flex flex-1 items-center justify-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.25s" }}
        >
          <ChatPhone visible={isInView} />
        </div>
      </div>
    </section>
  )
}
