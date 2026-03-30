"use client"

import { useInView } from "@/hooks/use-in-view"

export function CTAFooter() {
  const { ref, isInView } = useInView()

  return (
    <>
      {/* CTA Section */}
      <section
        ref={ref}
        className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 py-24"
      >
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
          {/* Grape decoration */}
          <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-10">
            <svg viewBox="0 0 100 120" className="h-60 w-60" fill="white">
              <circle cx="50" cy="20" r="15" />
              <circle cx="30" cy="40" r="15" />
              <circle cx="70" cy="40" r="15" />
              <circle cx="20" cy="65" r="15" />
              <circle cx="50" cy="60" r="15" />
              <circle cx="80" cy="65" r="15" />
              <circle cx="35" cy="85" r="15" />
              <circle cx="65" cy="85" r="15" />
              <circle cx="50" cy="105" r="12" />
            </svg>
          </div>
        </div>

        <div
          className={`relative mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6 lg:px-8 ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          {/* Badge */}
          <span className="mb-6 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur">
            무료로 시작하세요
          </span>
          
          <h2 className="text-2xl font-bold leading-snug text-primary-foreground sm:text-3xl md:text-4xl">
            <span className="block">포도알처럼 하나씩,</span>
            <span className="block">오늘부터 시작해볼까요?</span>
          </h2>
          
          <p className="mt-4 max-w-md text-base leading-relaxed text-primary-foreground/80 md:text-lg">
            <span className="block">복잡한 가입 절차 없이</span>
            <span className="block">메신저 하나로 바로 시작하세요.</span>
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <button className="group flex items-center gap-2 rounded-xl bg-card px-8 py-4 text-lg font-semibold text-primary shadow-lg transition-all hover:bg-card/90 hover:shadow-xl">
              <span>지금 시작하기</span>
              <svg 
                className="h-5 w-5 transition-transform group-hover:translate-x-1" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button className="flex items-center gap-2 rounded-xl border-2 border-white/30 bg-transparent px-6 py-3.5 font-medium text-primary-foreground transition-all hover:bg-white/10">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
              </svg>
              <span>사용법 보기</span>
            </button>
          </div>

          {/* Trust indicators */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>신용카드 불필요</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>30초 만에 시작</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>언제든 해지 가능</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4 text-primary-foreground"
                >
                  <circle cx="12" cy="8" r="3" fill="currentColor" />
                  <circle cx="7" cy="14" r="3" fill="currentColor" />
                  <circle cx="17" cy="14" r="3" fill="currentColor" />
                </svg>
              </div>
              <span className="text-lg font-bold text-background">포도가계부</span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-background/60">
              <a href="#" className="transition-colors hover:text-background">
                서비스 소개
              </a>
              <a href="#" className="transition-colors hover:text-background">
                자주 묻는 질문
              </a>
              <a href="#" className="transition-colors hover:text-background">
                개인정보처리방침
              </a>
              <a href="#" className="transition-colors hover:text-background">
                이용약관
              </a>
              <a href="#" className="transition-colors hover:text-background">
                문의하기
              </a>
            </div>

            {/* Social */}
            <div className="flex items-center gap-4">
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 text-background/60 transition-colors hover:bg-background/20 hover:text-background">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 text-background/60 transition-colors hover:bg-background/20 hover:text-background">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>

            {/* Copyright */}
            <p className="text-sm text-background/40">
              © 2026 포도가계부. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
