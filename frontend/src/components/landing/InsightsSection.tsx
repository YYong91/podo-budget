import { useEffect, useState } from 'react'
import { useInView } from '../../hooks/useInView'

const SLIDES = [
  { src: "/screenshot-report-1.jpg", alt: "월간 리포트 — 요약" },
  { src: "/screenshot-report-2.jpg", alt: "월간 리포트 — 카테고리·예산" },
  { src: "/screenshot-report-3.jpg", alt: "월간 리포트 — AI 분석" },
]

const SLIDE_INTERVAL = 3000

export function InsightsSection() {
  const { ref, isInView } = useInView()
  const [current, setCurrent] = useState(0)

  // 섹션이 보일 때만 자동 슬라이드
  useEffect(() => {
    if (!isInView) return
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length)
    }, SLIDE_INTERVAL)
    return () => clearInterval(id)
  }, [isInView])

  return (
    <section
      className="relative overflow-hidden py-28"
      style={{ background: "linear-gradient(160deg, #fefce8 0%, #faf5ff 100%)" }}
    >
      {/* 배경 블롭 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-grape-500/5 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-grape-500/10 blur-3xl" />
      </div>

      <div
        ref={ref}
        className="relative mx-auto flex max-w-5xl flex-col items-center px-4 sm:px-6 lg:px-8"
      >
        {/* 헤더 */}
        <div className={`mb-16 text-center ${isInView ? "animate-fade-in-up" : "opacity-0"}`}>
          <span className="mb-4 inline-block rounded-full bg-grape-500/10 px-4 py-1.5 text-sm font-medium text-grape-500">
            돌아보기
          </span>
          <h2 className="mt-4 text-2xl font-bold leading-snug text-warm-900 sm:text-3xl md:text-4xl">
            <span className="block">이달의 소비,</span>
            <span className="block">한눈에 돌아보기</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-warm-500">
            AI가 분석한 소비 패턴으로
            <br />더 나은 습관을 만들어가세요.
          </p>
        </div>

        {/* 폰 목업 + 슬라이드 */}
        <div
          className={`flex flex-col items-center ${isInView ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "0.2s" }}
        >
          {/* 폰 프레임 */}
          <div className="relative h-[560px] w-[272px] overflow-hidden rounded-[3rem] border-[7px] border-stone-900/10 bg-white shadow-2xl md:h-[620px] md:w-[295px]">
            {/* Notch */}
            <div className="absolute left-1/2 top-[5px] z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-stone-900/10" />

            {/* 슬라이드 트랙 */}
            <div
              className="flex h-full transition-transform duration-700 ease-in-out"
              style={{ width: `${SLIDES.length * 100}%`, transform: `translateX(-${current * (100 / SLIDES.length)}%)` }}
            >
              {SLIDES.map((slide) => (
                <div
                  key={slide.src}
                  className="relative overflow-hidden"
                  style={{ width: `${100 / SLIDES.length}%`, flexShrink: 0 }}
                >
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className="w-full object-cover"
                    style={{ objectPosition: "top", marginTop: "-44px", height: "calc(100% + 44px)" }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 인디케이터 */}
          <div className="mt-5 flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 bg-grape-500 h-2"
                    : "w-2 bg-warm-300 h-2 hover:bg-warm-400"
                }`}
                aria-label={`슬라이드 ${i + 1}`}
              />
            ))}
          </div>

          {/* 뱃지 */}
          <div className="mt-5">
            <span className="rounded-full border border-grape-200 bg-grape-100 px-4 py-2 text-sm font-medium text-grape-500">
              언제든 현황 확인
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
