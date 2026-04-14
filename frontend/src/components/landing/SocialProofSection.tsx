import { useEffect, useRef, useState } from "react"
import { socialStats, socialScenarios } from '../../data/landingData'

function useCountUp(target: number, duration = 2000, started = false) {
  const [value, setValue] = useState(0)
  const prevStarted = useRef(false)

  useEffect(() => {
    if (!started) return

    // 리셋은 시작 전환 시에만 (started가 false → true로 바뀔 때)
    if (!prevStarted.current) {
      prevStarted.current = true
    }

    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [started, target, duration])

  return value
}

// 인덱스별 SVG 아이콘 (0: 시계, 1: 레이어, 2: 쉴드체크)
const statIcons = [
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 6 12 12 15.5 14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
    <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round" />
    <path d="M2 17l10 5 10-5" strokeLinejoin="round" />
    <path d="M2 12l10 5 10-5" strokeLinejoin="round" />
  </svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
    <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" strokeLinejoin="round" />
    <path d="M12 6v2m0 8v2M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
]

export function SocialProofSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const count0 = useCountUp(socialStats[0].value, 1800, inView)
  const count1 = useCountUp(socialStats[1].value, 2000, inView)
  const count2 = useCountUp(socialStats[2].value, 1400, inView)
  const counts = [count0, count1, count2]

  return (
    <section ref={sectionRef} className="w-full bg-grape-50 py-24">
      <div className="mx-auto max-w-5xl px-6">

        {/* 섹션 라벨 */}
        <div
          className="mb-14 text-center"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
          }}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-grape-400">
            사용자 시나리오
          </p>
          <h2 className="text-balance text-3xl font-bold text-warm-800 sm:text-4xl">
            이런 분께 딱 맞아요
          </h2>
        </div>

        {/* 스탯 행 */}
        <div className="mb-20 grid grid-cols-3 gap-3 sm:gap-6">
          {socialStats.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-3 rounded-3xl bg-white p-5 text-center shadow-sm sm:p-8"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.6s ease-out ${i * 0.1}s, transform 0.6s ease-out ${i * 0.1}s`,
              }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-grape-100 text-grape-600">
                {statIcons[i]}
              </div>
              <div>
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-3xl font-extrabold tabular-nums text-grape-600 sm:text-4xl">
                    {counts[i]}
                  </span>
                  <span className="text-lg font-bold text-grape-500 sm:text-xl">{stat.suffix}</span>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-warm-700">{stat.label}</p>
              </div>
              <p className="hidden whitespace-pre-line text-xs leading-relaxed text-warm-400 sm:block">
                {stat.description}
              </p>
            </div>
          ))}
        </div>

        {/* 구분선 */}
        <div
          className="mb-12 flex items-center gap-4"
          style={{
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s ease-out 0.4s",
          }}
        >
          <div className="h-px flex-1 bg-grape-200" />
          <span className="text-xs font-semibold tracking-wider text-grape-400">실제 사용 이야기</span>
          <div className="h-px flex-1 bg-grape-200" />
        </div>

        {/* 시나리오 카드 — 문제→해결 구조 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {socialScenarios.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(28px)",
                transition: `opacity 0.6s ease-out ${0.45 + i * 0.12}s, transform 0.6s ease-out ${0.45 + i * 0.12}s`,
              }}
            >
              <span className="inline-block rounded-full bg-grape-100 px-3 py-1 text-sm font-medium text-grape-700">
                {s.persona}
              </span>
              <p className="mt-4 text-base italic text-warm-600">
                &ldquo;{s.problem}&rdquo;
              </p>
              <p className="mt-3 text-sm font-semibold text-grape-700">
                → {s.solution}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
