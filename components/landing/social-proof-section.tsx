"use client"

import { useEffect, useRef, useState } from "react"

function useCountUp(target: number, duration = 2000, started = false) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!started) return
    setValue(0)
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOut cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [started, target, duration])

  return value
}

const stats = [
  { value: 1200, suffix: "+ 가구", label: "포도와 함께하는" },
  { value: 25000, suffix: "+ 건", label: "누적 거래 기록" },
  { value: 30, suffix: "초", label: "평균 기록 소요 시간" },
]

const reviews = [
  {
    name: "김지수",
    role: "30대 직장인",
    comment: "카카오톡에 그냥 보내면 다 기록돼요. 이게 진짜 되나 싶었는데 신기했어요.",
    stars: 5,
    avatar: "지",
    avatarBg: "bg-violet-100 text-violet-600",
  },
  {
    name: "박민준",
    role: "신혼부부",
    comment: "남편이랑 같이 쓰는데 서로 얼마 썼는지 바로 보여서 싸울 일이 없어졌어요.",
    stars: 5,
    avatar: "민",
    avatarBg: "bg-emerald-100 text-emerald-600",
  },
  {
    name: "이서연",
    role: "대학원생",
    comment: "월말에 '이번달 어디다 썼지?'가 사라졌어요. 30초도 안 걸려요.",
    stars: 5,
    avatar: "서",
    avatarBg: "bg-amber-100 text-amber-600",
  },
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
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const count0 = useCountUp(stats[0].value, 2000, inView)
  const count1 = useCountUp(stats[1].value, 2000, inView)
  const count2 = useCountUp(stats[2].value, 1600, inView)

  const counts = [count0, count1, count2]

  return (
    <section
      ref={sectionRef}
      className="w-full bg-violet-50 py-24"
    >
      <div className="mx-auto max-w-5xl px-6">

        {/* Heading */}
        <div
          className="mb-16 text-center"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
          }}
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-500">
            실제 사용자 이야기
          </p>
          <h2 className="text-3xl font-bold text-stone-800 sm:text-4xl">
            이미 많은 가구가<br className="sm:hidden" /> 포도로 기록하고 있어요
          </h2>
        </div>

        {/* Stats */}
        <div className="mb-20 grid grid-cols-3 gap-4 sm:gap-8">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 text-center"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.6s ease-out ${i * 0.1}s, transform 0.6s ease-out ${i * 0.1}s`,
              }}
            >
              <span className="text-3xl font-extrabold tabular-nums text-violet-600 sm:text-5xl">
                {counts[i].toLocaleString("ko-KR")}
                <span className="text-2xl sm:text-3xl">{stat.suffix}</span>
              </span>
              <span className="text-sm text-stone-500 sm:text-base">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mb-14 flex items-center gap-4">
          <div className="h-px flex-1 bg-violet-100" />
          <span className="text-xs font-medium text-violet-400">사용자 후기</span>
          <div className="h-px flex-1 bg-violet-100" />
        </div>

        {/* Review cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(28px)",
                transition: `opacity 0.6s ease-out ${0.3 + i * 0.12}s, transform 0.6s ease-out ${0.3 + i * 0.12}s`,
              }}
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: review.stars }).map((_, s) => (
                  <svg key={s} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-400">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Comment */}
              <p className="flex-1 text-[15px] leading-relaxed text-stone-600">
                &ldquo;{review.comment}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${review.avatarBg}`}>
                  {review.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{review.name}</p>
                  <p className="text-xs text-stone-400">{review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
