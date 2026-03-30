"use client"

import { useInView } from "@/hooks/use-in-view"

export function SharedSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative min-h-screen bg-muted/30 py-20">
      <div
        ref={ref}
        className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col-reverse items-center justify-center gap-12 px-4 sm:px-6 md:flex-row lg:px-8"
      >
        {/* Screenshot Placeholder */}
        <div
          className={`flex flex-1 items-center justify-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xl">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">이번 달 가계부</h3>
              <span className="text-sm text-muted-foreground">3월</span>
            </div>

            {/* Transaction list mockup */}
            <div className="space-y-3">
              {[
                { name: "김치찌개", amount: "8,000원", member: "엄마", avatar: "🧑‍🍳" },
                { name: "지하철 충전", amount: "50,000원", member: "아빠", avatar: "👨" },
                { name: "문구류", amount: "12,000원", member: "아들", avatar: "👦" },
                { name: "장보기", amount: "45,000원", member: "엄마", avatar: "🧑‍🍳" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-muted/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm">
                      {item.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.member}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">-{item.amount}</span>
                </div>
              ))}
            </div>

            {/* Placeholder label */}
            <div className="mt-6 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">공유 가계부 스크린샷</span>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div
          className={`flex flex-1 flex-col items-center text-center md:items-start md:text-left ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <h2 className="text-balance text-2xl font-bold text-foreground md:text-4xl">
            가족과 함께 쓰는 가계부
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground md:mt-6 md:text-lg">
            가구를 만들고 가족을 초대하세요. 누가 얼마를 썼는지 한눈에, 하나의
            가계부를 함께 기록할 수 있어요.
          </p>
        </div>
      </div>
    </section>
  )
}
