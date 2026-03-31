import { useEffect, useState } from "react"
import { useInView } from '../../hooks/useInView'

const CHAT_SEQUENCE = [
  { id: 1, type: "user" as const,   text: "점심 김치찌개 8000원", delay: 600 },
  { id: 2, type: "typing" as const,                               delay: 1100 },
  { id: 3, type: "ai" as const,     parsed: true,                 delay: 1900 },
  { id: 4, type: "ai" as const,     text: "기록됐어요! 오늘 식비는 총 18,500원이에요 🍇", delay: 2500 },
]

// 채팅 완료 후 거래목록 전환 타이밍
const SHOW_LIST_DELAY = 3800   // 채팅 완료 후 거래목록 등장
const RESET_DELAY    = 7500   // 거래목록 보여주다가 다시 채팅으로
const LOOP_DELAY     = 8000   // 루프 재시작

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

function ParsedCard() {
  return (
    <div className="rounded-xl border border-grape-100 bg-white p-3 shadow-sm text-xs">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-grape-100 text-[10px]">✓</span>
        <span className="font-semibold text-grape-700">파싱 완료</span>
      </div>
      <div className="space-y-1.5">
        {[
          { label: "금액",      value: "8,000원",       color: "text-rose-500" },
          { label: "카테고리",  value: "🍽 식비",       color: "text-amber-600" },
          { label: "메모",      value: "점심 · 김치찌개", color: "text-stone-600" },
          { label: "날짜",      value: "오늘",           color: "text-stone-600" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-stone-400">{row.label}</span>
            <span className={`font-medium ${row.color}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatPhone({ visible }: { visible: boolean }) {
  const [loopKey, setLoopKey] = useState(0)
  const [step, setStep] = useState(0)
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    if (!visible) return

    const timers: ReturnType<typeof setTimeout>[] = []

    CHAT_SEQUENCE.forEach((msg) => {
      timers.push(setTimeout(() => setStep((s) => Math.max(s, msg.id)), msg.delay))
    })

    // 채팅 완료 후 거래목록으로 슬라이드업
    timers.push(setTimeout(() => setShowList(true), SHOW_LIST_DELAY))

    // 거래목록에서 다시 채팅으로
    timers.push(setTimeout(() => {
      setStep(0)
      setShowList(false)
    }, RESET_DELAY))

    // 루프 재시작
    timers.push(setTimeout(() => setLoopKey((k) => k + 1), LOOP_DELAY))

    return () => timers.forEach(clearTimeout)
  }, [visible, loopKey])

  return (
    <div className="relative h-[540px] w-[268px] overflow-hidden rounded-[3rem] border-[7px] border-stone-900/10 bg-white shadow-2xl md:h-[600px] md:w-[290px]">
      {/* Notch */}
      <div className="absolute left-1/2 top-[5px] z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-stone-900/10" />

      {/* 두 화면을 수직으로 쌓아 translateY로 전환 */}
      <div
        className="absolute inset-0 flex flex-col transition-transform duration-700 ease-in-out"
        style={{ transform: showList ? "translateY(-50%)" : "translateY(0)" }}
      >
        {/* ── 채팅 화면 ── */}
        <div className="flex h-full w-full flex-shrink-0 flex-col">
          {/* Status bar */}
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

          {/* Chat header */}
          <div className="flex items-center gap-2 border-b border-stone-100 bg-white px-4 py-2.5 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-grape-100 text-base">🍇</div>
            <div>
              <p className="text-xs font-bold text-stone-800">포도 가계부 AI</p>
              <p className="text-[10px] text-emerald-500">온라인</p>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex flex-1 flex-col gap-2.5 overflow-hidden px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-stone-100" />
              <span className="text-[10px] text-stone-400">오늘</span>
              <div className="h-px flex-1 bg-stone-100" />
            </div>

            {step >= 1 && (
              <div className="animate-bubble-in flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-grape-600 px-3 py-2 text-xs text-white shadow-sm">
                  점심 김치찌개 8000원
                </div>
              </div>
            )}

            {step >= 2 && step < 3 && (
              <div className="animate-bubble-in flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-stone-100 px-3 py-2">
                  <TypingDots />
                </div>
              </div>
            )}

            {step >= 3 && (
              <div className="animate-bubble-in flex justify-start">
                <div className="max-w-[85%]">
                  <ParsedCard />
                </div>
              </div>
            )}

            {step >= 4 && (
              <div className="animate-bubble-in flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-stone-100 px-3 py-2 text-xs leading-relaxed text-stone-700 shadow-sm">
                  기록됐어요! 오늘 식비는<br />총 18,500원이에요 🍇
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
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

        {/* ── 거래목록 화면 (스크린샷) ── */}
        <div className="flex h-full w-full flex-shrink-0 overflow-hidden">
          <img
            src="/screenshot-transactions.jpg"
            alt="거래 목록"
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>
    </div>
  )
}

export function HeroSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative min-h-screen overflow-hidden bg-cream pt-16">
      {/* Grape glow orb */}
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
        {/* Text Content */}
        <div
          className={`flex flex-1 flex-col items-center text-center md:items-start md:text-left ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-grape-200 bg-grape-50 px-3.5 py-1 text-xs font-medium text-grape-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-grape-500" />
            AI 가계부의 새로운 기준
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

          <button
            className="mt-8 font-bold text-white text-base shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-grape-300/60 hover:shadow-xl active:scale-95"
            style={{
              borderRadius: 32,
              background: "linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)",
              padding: "14px 36px",
              boxShadow: "0 8px 24px rgba(168,85,247,0.30)",
            }}
          >
            지금 무료로 시작하기 →
          </button>
          <p className="mt-3 text-xs text-stone-400">신용카드 불필요 · 30초면 충분해요</p>
        </div>

        {/* Phone Mockup */}
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
