import { useEffect, useRef, useState } from "react"

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

const stats = [
  {
    value: 30,
    unit: "초",
    suffix: "만에 입력",
    desc: "길게 쓸 필요 없이\n한 줄이면 충분해요",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 6 12 12 15.5 14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: 100,
    unit: "%",
    suffix: "자동 카테고리",
    desc: "식비·교통·쇼핑\nAI가 알아서 분류해요",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: 1,
    unit: "번",
    suffix: "매월 AI 리포트",
    desc: "월말마다 자동으로\n소비 패턴을 분석해요",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 16l4-5 4 3 4-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const scenarios = [
  {
    tag: "맞벌이 부부",
    tagColor: "bg-grape-100 text-grape-700",
    quote: "매달 가계부 정리에 30분 쓰던 시간이 사라졌어요.",
    initial: "김",
    avatarBg: "bg-grape-200 text-grape-700",
  },
  {
    tag: "자취 3년차",
    tagColor: "bg-leaf-100 text-leaf-700",
    quote: "카톡으로 보내면 끝이라 까먹을 일이 없어요.",
    initial: "이",
    avatarBg: "bg-leaf-200 text-leaf-700",
  },
  {
    tag: "육아맘",
    tagColor: "bg-amber-100 text-amber-700",
    quote: "남편이랑 같이 쓰니까 누가 뭘 썼는지 한눈에.",
    initial: "박",
    avatarBg: "bg-amber-200 text-amber-700",
  },
]

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-400">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

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

  const count0 = useCountUp(stats[0].value, 1800, inView)
  const count1 = useCountUp(stats[1].value, 2000, inView)
  const count2 = useCountUp(stats[2].value, 1400, inView)
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
            왜 포도인가요
          </p>
          <h2 className="text-balance text-3xl font-bold text-warm-800 sm:text-4xl">
            기록이 습관이 되는<br className="sm:hidden" /> 가장 쉬운 방법
          </h2>
        </div>

        {/* 스탯 행 */}
        <div className="mb-20 grid grid-cols-3 gap-3 sm:gap-6">
          {stats.map((stat, i) => (
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
                {stat.icon}
              </div>
              <div>
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-3xl font-extrabold tabular-nums text-grape-600 sm:text-4xl">
                    {counts[i]}
                  </span>
                  <span className="text-lg font-bold text-grape-500 sm:text-xl">{stat.unit}</span>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-warm-700">{stat.suffix}</p>
              </div>
              <p className="hidden whitespace-pre-line text-xs leading-relaxed text-warm-400 sm:block">
                {stat.desc}
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

        {/* 시나리오 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {scenarios.map((s, i) => (
            <div
              key={i}
              className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-sm"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(28px)",
                transition: `opacity 0.6s ease-out ${0.45 + i * 0.12}s, transform 0.6s ease-out ${0.45 + i * 0.12}s`,
              }}
            >
              {/* 태그 + 별점 */}
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.tagColor}`}>
                  {s.tag}
                </span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => <StarIcon key={j} />)}
                </div>
              </div>

              {/* 인용문 */}
              <p className="flex-1 text-[15px] leading-relaxed text-warm-600">
                &ldquo;{s.quote}&rdquo;
              </p>

              {/* 아바타 */}
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${s.avatarBg}`}>
                  {s.initial}
                </div>
                <span className="text-xs text-warm-400">포도 사용자</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
