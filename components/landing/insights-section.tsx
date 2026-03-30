"use client"

import { useInView } from "@/hooks/use-in-view"

export function InsightsSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative min-h-screen bg-background py-20">
      <div
        ref={ref}
        className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col items-center justify-center gap-12 px-4 sm:px-6 md:flex-row lg:px-8"
      >
        {/* Chart Mockup - Mobile First, so it comes first visually on small screens */}
        <div
          className={`order-2 flex flex-1 items-center justify-center md:order-1 ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <div className="w-full max-w-md">
            {/* Main Card */}
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">2026년 3월</p>
                    <h3 className="mt-1 text-2xl font-bold">월간 리포트</h3>
                  </div>
                  <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                    <span className="text-2xl font-bold">85</span>
                    <span className="text-[10px] opacity-80">건강점수</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Summary Stats */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground">총 지출</p>
                    <p className="mt-1 text-xl font-bold text-foreground">892,000원</p>
                    <p className="mt-0.5 text-xs text-accent">예산의 89%</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground">저번 달 대비</p>
                    <p className="mt-1 text-xl font-bold text-foreground">-12%</p>
                    <p className="mt-0.5 text-xs text-accent">잘하고 있어요!</p>
                  </div>
                </div>

                {/* Donut Chart with improved design */}
                <div className="mb-6 flex items-center gap-6">
                  <div className="relative h-32 w-32 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="16"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="16"
                        strokeDasharray="100 151.4"
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="hsl(var(--accent))"
                        strokeWidth="16"
                        strokeDasharray="60 191.4"
                        strokeDashoffset="-100"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="16"
                        strokeDasharray="40 211.4"
                        strokeDashoffset="-160"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground">카테고리</span>
                      <span className="text-sm font-semibold text-foreground">6개</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-1 flex-col gap-2">
                    {[
                      { name: "식비", amount: "320,000원", color: "bg-primary", percent: "36%" },
                      { name: "교통", amount: "150,000원", color: "bg-accent", percent: "17%" },
                      { name: "쇼핑", amount: "120,000원", color: "bg-amber-500", percent: "13%" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        <span className="flex-1 text-sm text-foreground">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{item.percent}</span>
                      </div>
                    ))}
                    <p className="mt-1 text-xs text-muted-foreground">외 3개 카테고리</p>
                  </div>
                </div>

                {/* Insights */}
                <div className="rounded-xl bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">AI 인사이트</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        식비 지출이 지난달보다 15% 줄었어요. 이 속도면 목표 달성 가능해요!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="mt-4 flex justify-center">
              <span className="rounded-full bg-accent/20 px-4 py-2 text-sm font-medium text-accent">
                매월 자동 생성
              </span>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div
          className={`order-1 flex flex-1 flex-col items-center text-center md:order-2 md:items-start md:text-left ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            돌아보기
          </span>
          <h2 className="text-2xl font-bold leading-snug text-foreground sm:text-3xl md:text-4xl">
            <span className="block">이달의 소비,</span>
            <span className="block">한눈에 돌아보기</span>
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground md:mt-6 md:text-lg">
            <span className="block">카테고리별 지출 현황부터</span>
            <span className="block">예산 대비 달성률까지.</span>
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            AI가 분석한 소비 패턴과 인사이트로
            <br className="hidden sm:block" />
            더 나은 소비 습관을 만들어가세요.
          </p>

          {/* Feature highlights */}
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            {["카테고리별 분석", "예산 달성률", "소비 트렌드", "AI 인사이트"].map((tag, i) => (
              <span
                key={i}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
