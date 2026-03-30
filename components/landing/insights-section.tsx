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
        {/* Text Content */}
        <div
          className={`flex flex-1 flex-col items-center text-center md:items-start md:text-left ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <h2 className="text-balance text-2xl font-bold text-foreground md:text-4xl">
            이달의 소비를 돌아보세요
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground md:mt-6 md:text-lg">
            카테고리별 지출, 예산 대비 현황, 건강 점수까지. 우리 가계부의 흐름을
            한눈에 파악할 수 있어요.
          </p>
        </div>

        {/* Chart Mockup */}
        <div
          className={`flex flex-1 items-center justify-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xl">
            {/* Header */}
            <div className="mb-6">
              <h3 className="font-semibold text-foreground">3월 리포트</h3>
              <p className="text-sm text-muted-foreground">카테고리별 지출 현황</p>
            </div>

            {/* Simple donut chart mockup */}
            <div className="mb-6 flex items-center justify-center">
              <div className="relative h-40 w-40">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="20"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="20"
                    strokeDasharray="100 151.4"
                    strokeDashoffset="0"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(var(--accent))"
                    strokeWidth="20"
                    strokeDasharray="60 191.4"
                    strokeDashoffset="-100"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="20"
                    strokeDasharray="40 211.4"
                    strokeDashoffset="-160"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">85점</span>
                  <span className="text-xs text-muted-foreground">건강 점수</span>
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="space-y-3">
              {[
                { name: "식비", amount: "320,000원", color: "bg-primary", percent: "40%" },
                { name: "교통", amount: "150,000원", color: "bg-accent", percent: "24%" },
                { name: "쇼핑", amount: "120,000원", color: "bg-amber-500", percent: "16%" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${item.color}`} />
                  <span className="flex-1 text-sm text-foreground">{item.name}</span>
                  <span className="text-sm text-muted-foreground">{item.percent}</span>
                  <span className="text-sm font-medium text-foreground">{item.amount}</span>
                </div>
              ))}
            </div>

            {/* Placeholder label */}
            <div className="mt-6 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">돌아보기 스크린샷</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
