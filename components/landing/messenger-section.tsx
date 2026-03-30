"use client"

import { useInView } from "@/hooks/use-in-view"

export function MessengerSection() {
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
            채팅으로 기록하세요
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground md:mt-6 md:text-lg">
            카카오톡이나 텔레그램에서 &apos;점심 김치찌개 8000원&apos; 한 줄이면 끝.
            AI가 카테고리, 날짜, 결제수단까지 알아서 분류합니다.
          </p>
        </div>

        {/* Chat Mockup */}
        <div
          className={`flex flex-1 items-center justify-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl">
            {/* Chat Header */}
            <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-primary-foreground"
                >
                  <circle cx="12" cy="8" r="3" fill="currentColor" />
                  <circle cx="7" cy="14" r="3" fill="currentColor" />
                  <circle cx="17" cy="14" r="3" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-foreground">포도가계부</p>
                <p className="text-xs text-muted-foreground">AI 가계부 봇</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="space-y-4">
              {/* User message 1 */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/20 px-4 py-2.5">
                  <p className="text-sm text-foreground">점심 김치찌개 8000원</p>
                </div>
              </div>

              {/* Bot response 1 */}
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 shadow-sm">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">카테고리</span>
                      <span className="font-medium text-foreground">식비</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">금액</span>
                      <span className="font-medium text-foreground">8,000원</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">날짜</span>
                      <span className="font-medium text-foreground">오늘</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-accent">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium">저장되었습니다</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User message 2 */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/20 px-4 py-2.5">
                  <p className="text-sm text-foreground">어제 택시 15000원 카드로</p>
                </div>
              </div>

              {/* Bot response 2 */}
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 shadow-sm">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">카테고리</span>
                      <span className="font-medium text-foreground">교통</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">금액</span>
                      <span className="font-medium text-foreground">15,000원</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">결제수단</span>
                      <span className="font-medium text-foreground">카드</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-accent">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium">저장되었습니다</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
