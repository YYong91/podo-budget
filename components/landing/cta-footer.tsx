"use client"

import { useInView } from "@/hooks/use-in-view"

export function CTAFooter() {
  const { ref, isInView } = useInView()

  return (
    <>
      {/* CTA Section */}
      <section
        ref={ref}
        className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 py-24"
      >
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div
          className={`relative mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6 lg:px-8 ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <h2 className="text-balance text-2xl font-bold text-primary-foreground md:text-4xl">
            포도알처럼 하나씩,
            <br />
            지금 시작하세요
          </h2>
          <button className="mt-8 rounded-xl bg-card px-8 py-4 text-lg font-semibold text-primary shadow-lg transition-all hover:bg-card/90 hover:shadow-xl">
            시작하기
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          {/* Links */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">
              개인정보처리방침
            </a>
            <span className="text-border">|</span>
            <a href="#" className="transition-colors hover:text-foreground">
              이용약관
            </a>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">© 2026 포도가계부</p>
        </div>
      </footer>
    </>
  )
}
