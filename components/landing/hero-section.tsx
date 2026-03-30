"use client"

import { useInView } from "@/hooks/use-in-view"

export function HeroSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative min-h-screen overflow-hidden pt-16">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/20 to-transparent blur-3xl" />
      </div>

      <div
        ref={ref}
        className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center gap-8 px-4 py-12 sm:px-6 md:flex-row md:gap-12 lg:px-8"
      >
        {/* Text Content */}
        <div
          className={`flex flex-1 flex-col items-center text-center md:items-start md:text-left ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
            <span className="block">포도알처럼 하나씩,</span>
            <span className="block">알찬 가계부</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground md:mt-6 md:text-lg">
            <span className="block sm:inline">말로 기록하면</span>{" "}
            <span className="block sm:inline">AI가 알아서 분류하는</span>
            <br className="hidden sm:block" />
            우리 집 가계부
          </p>
          <button className="mt-8 rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30">
            지금 시작하기
          </button>
        </div>

        {/* Phone Mockup */}
        <div
          className={`flex flex-1 items-center justify-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <div className="relative">
            {/* Phone frame */}
            <div className="relative h-[500px] w-[260px] overflow-hidden rounded-[3rem] border-8 border-foreground/10 bg-card shadow-2xl md:h-[580px] md:w-[290px]">
              {/* Screen content placeholder */}
              <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50 p-4">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6 text-primary"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="8" r="3" fill="currentColor" />
                    <circle cx="7" cy="14" r="3" fill="currentColor" />
                    <circle cx="17" cy="14" r="3" fill="currentColor" />
                    <circle cx="12" cy="18" r="2" fill="currentColor" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  앱 스크린샷
                </span>
              </div>
            </div>
            {/* Notch */}
            <div className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-foreground/10 md:top-3" />
          </div>
        </div>
      </div>
    </section>
  )
}
