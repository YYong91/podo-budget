"use client"

import { useInView } from "@/hooks/use-in-view"

const features = [
  {
    icon: "💰",
    title: "예산 관리",
    description: "카테고리별 예산 설정, 초과 시 알림",
  },
  {
    icon: "🔄",
    title: "정기결제",
    description: "매달 반복되는 지출 자동 기록",
  },
  {
    icon: "💳",
    title: "결제수단",
    description: "카드·현금·계좌별 관리",
  },
  {
    icon: "📊",
    title: "자산 현황",
    description: "내 자산의 흐름을 한눈에",
  },
  {
    icon: "🏷️",
    title: "카테고리",
    description: "나만의 카테고리로 분류",
  },
]

export function FeaturesSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative min-h-screen bg-muted/30 py-20">
      <div
        ref={ref}
        className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col items-center justify-center px-4 sm:px-6 lg:px-8"
      >
        {/* Title */}
        <div
          className={`mb-12 text-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <h2 className="text-balance text-2xl font-bold text-foreground md:text-4xl">
            꼼꼼하게, 더 편리하게
          </h2>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md ${
                isInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${0.1 * (i + 1)}s` }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
