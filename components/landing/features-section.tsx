"use client"

import { useInView } from "@/hooks/use-in-view"

const features = [
  {
    title: "예산 관리",
    description: "카테고리별 예산을 세우고, 초과 시 알림을 받아보세요. 계획적인 소비 습관이 만들어져요.",
    highlight: "초과 알림",
    iconBg: "bg-[#f3e8ff]",
    iconColor: "text-[#7e22ce]",
    highlightBg: "bg-[#f3e8ff] text-[#7e22ce]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: "정기결제 관리",
    description: "넷플릭스, 통신비, 보험료까지. 매달 나가는 고정 지출을 잊지 않고 관리해요.",
    highlight: "자동 기록",
    iconBg: "bg-[#dcfce7]",
    iconColor: "text-[#15803d]",
    highlightBg: "bg-[#dcfce7] text-[#15803d]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
  {
    title: "결제수단별 현황",
    description: "카드, 현금, 계좌이체. 어디서 얼마나 썼는지 한눈에 파악하세요.",
    highlight: "통합 관리",
    iconBg: "bg-[#fff7ed]",
    iconColor: "text-[#c2410c]",
    highlightBg: "bg-[#fff7ed] text-[#c2410c]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    title: "자산 트래킹",
    description: "은행 잔고부터 투자금까지. 내 전체 자산이 어떻게 흐르는지 추적해요.",
    highlight: "자산 현황",
    iconBg: "bg-[#fef9c3]",
    iconColor: "text-[#a16207]",
    highlightBg: "bg-[#fef9c3] text-[#a16207]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "맞춤 카테고리",
    description: "기본 카테고리가 안 맞으신다면? 나만의 분류 체계로 커스텀하세요.",
    highlight: "자유롭게",
    iconBg: "bg-[#f0fdf4]",
    iconColor: "text-[#15803d]",
    highlightBg: "bg-[#f0fdf4] text-[#15803d]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
]

export function FeaturesSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative bg-muted/30 py-28">
      <div
        ref={ref}
        className="mx-auto flex max-w-5xl flex-col items-center px-4 sm:px-6 lg:px-8"
      >
        {/* Title */}
        <div
          className={`mb-14 text-center ${isInView ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <span className="mb-4 inline-block rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent">
            편의 기능
          </span>
          <h2 className="mt-4 text-2xl font-bold leading-snug text-foreground sm:text-3xl md:text-4xl">
            <span className="block">꼼꼼하게,</span>
            <span className="block">더 편리하게</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
            일상의 모든 소비를 체계적으로 관리할 수 있도록
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[#c084fc] hover:shadow-lg ${
                isInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${0.08 * (i + 1)}s` }}
            >
              {/* Highlight badge */}
              <span className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-xs font-medium ${feature.highlightBg}`}>
                {feature.highlight}
              </span>

              {/* Icon */}
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${feature.iconBg} ${feature.iconColor}`}
              >
                {feature.icon}
              </div>

              <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
