import { useInView } from '../../hooks/useInView'

const sideStats = [
  {
    rotate: "-rotate-3",
    side: "left",
    offset: "-left-4 top-12 lg:-left-20",
    label: "이번 달 지출",
    value: "892,000원",
    sub: "예산의 89%",
    subColor: "text-grape-500",
    bg: "bg-grape-100",
    border: "border-grape-200",
  },
  {
    rotate: "rotate-3",
    side: "right",
    offset: "-right-4 top-24 lg:-right-20",
    label: "저번 달 대비",
    value: "-12%",
    sub: "잘하고 있어요!",
    subColor: "text-leaf-700",
    bg: "bg-leaf-100",
    border: "border-leaf-200",
  },
  {
    rotate: "-rotate-2",
    side: "left",
    offset: "-left-4 bottom-16 lg:-left-16",
    label: "최다 지출",
    value: "식비",
    sub: "320,000원 · 36%",
    subColor: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
]

export function InsightsSection() {
  const { ref, isInView } = useInView()

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
        <div
          className={`mb-16 text-center ${isInView ? "animate-fade-in-up" : "opacity-0"}`}
        >
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

        {/* 중앙 카드 + 플로팅 스탯 카드 */}
        <div
          className={`relative w-full max-w-sm ${isInView ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "0.2s" }}
        >
          {/* 플로팅 스탯 카드 — md 이상에서만 표시 */}
          {sideStats.map((s, i) => (
            <div
              key={i}
              className={`absolute z-10 hidden md:block ${s.offset} ${s.rotate} ${
                isInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${0.4 + i * 0.12}s` }}
            >
              <div className={`rounded-2xl border ${s.border} ${s.bg} px-5 py-4 shadow-lg`}>
                <p className="text-xs font-medium text-warm-500">{s.label}</p>
                <p className="mt-1 text-xl font-bold text-warm-900">{s.value}</p>
                <p className={`mt-0.5 text-xs font-medium ${s.subColor}`}>{s.sub}</p>
              </div>
            </div>
          ))}

          {/* 메인 리포트 카드 */}
          <div className="overflow-hidden rounded-3xl border border-warm-300 bg-white shadow-2xl">
            {/* 그라데이션 헤더 */}
            <div className="bg-gradient-to-br from-grape-700 to-grape-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-75">2026년 3월</p>
                  <h3 className="mt-1 text-2xl font-bold">월간 리포트</h3>
                </div>
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                  <span className="text-2xl font-bold">85</span>
                  <span className="text-[10px] opacity-80">건강점수</span>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* 도넛 차트 */}
              <div className="mb-6 flex items-center gap-5">
                <div className="relative h-28 w-28 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#e7e5e4" strokeWidth="14" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#a855f7" strokeWidth="14"
                      strokeDasharray="85 153" strokeDashoffset="0" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#22c55e" strokeWidth="14"
                      strokeDasharray="50 188" strokeDashoffset="-85" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" strokeWidth="14"
                      strokeDasharray="32 206" strokeDashoffset="-135" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-warm-500">카테고리</span>
                    <span className="text-sm font-bold text-warm-900">6개</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2.5">
                  {[
                    { name: "식비",   pct: "36%", dot: "bg-grape-500" },
                    { name: "교통",   pct: "17%", dot: "bg-leaf-500" },
                    { name: "쇼핑",   pct: "13%", dot: "bg-amber-400" },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                      <span className="flex-1 text-sm text-warm-900">{item.name}</span>
                      <span className="text-xs text-warm-500">{item.pct}</span>
                    </div>
                  ))}
                  <p className="text-xs text-warm-500">외 3개 카테고리</p>
                </div>
              </div>

              {/* AI 인사이트 */}
              <div className="flex items-start gap-3 rounded-2xl bg-grape-50 p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-grape-500/20">
                  <svg className="h-4 w-4 text-grape-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-warm-900">AI 인사이트</p>
                  <p className="mt-1 text-xs leading-relaxed text-warm-500">
                    식비가 지난달보다 15% 줄었어요. 이 속도면 이번 달 목표 달성 가능해요!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* "매월 자동 생성" 뱃지 */}
          <div className="mt-5 flex justify-center">
            <span className="rounded-full border border-grape-200 bg-grape-100 px-4 py-2 text-sm font-medium text-grape-500">
              매월 자동 생성
            </span>
          </div>
        </div>

        {/* 모바일 스탯 (sm에서만 표시) */}
        <div className="mt-10 flex flex-wrap justify-center gap-3 md:hidden">
          {sideStats.map((s) => (
            <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} px-5 py-3 shadow-sm`}>
              <p className="text-xs text-warm-500">{s.label}</p>
              <p className="mt-0.5 text-base font-bold text-warm-900">{s.value}</p>
              <p className={`text-xs font-medium ${s.subColor}`}>{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
