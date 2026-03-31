import { useInView } from '../../hooks/useInView'

export function MessengerSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative min-h-screen bg-cream py-20">
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
          <span className="mb-4 inline-block rounded-full bg-grape-500/10 px-4 py-1.5 text-sm font-medium text-grape-500">
            핵심 기능
          </span>
          <h2 className="text-2xl font-bold leading-snug text-warm-900 sm:text-3xl md:text-4xl">
            <span className="block">메신저로</span>
            <span className="block">기록하세요</span>
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-warm-500 md:mt-6 md:text-lg">
            <span className="block sm:inline">카카오톡, 텔레그램 등</span>{" "}
            <span className="block sm:inline">평소 쓰는 메신저에서</span>
          </p>
          <p className="mt-2 max-w-lg text-base leading-relaxed text-warm-500 md:text-lg">
            <span className="font-medium text-warm-900">&apos;점심 김치찌개 8000원&apos;</span>{" "}
            <span className="block sm:inline">한 줄이면 끝.</span>
          </p>
          <p className="mt-4 text-base leading-relaxed text-warm-500 md:text-lg">
            카테고리, 날짜, 결제수단까지 알아서 분류해드려요.
          </p>

          {/* Messenger Icons */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-[#FEE500] px-4 py-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#3C1E1E">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.77 1.81 5.2 4.5 6.6-.14.85-.5 2.57-.57 2.97-.09.52.19.51.4.37.17-.11 2.53-1.72 3.56-2.42.69.1 1.4.15 2.11.15 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
              </svg>
              <span className="text-sm font-medium text-[#3C1E1E]">카카오톡</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#0088cc] px-4 py-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <span className="text-sm font-medium text-white">텔레그램</span>
            </div>
          </div>
        </div>

        {/* Chat Mockup */}
        <div
          className={`flex flex-1 items-center justify-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-warm-300 bg-white p-6 shadow-xl">
            {/* Chat Header */}
            <div className="mb-6 flex items-center gap-3 border-b border-warm-300 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-grape-500">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-white"
                >
                  <circle cx="12" cy="8" r="3" fill="currentColor" />
                  <circle cx="7" cy="14" r="3" fill="currentColor" />
                  <circle cx="17" cy="14" r="3" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-warm-900">포도가계부</p>
                <p className="text-xs text-warm-500">AI 가계부 봇</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="space-y-4">
              {/* User message 1 */}
              <div
                className={`flex justify-end ${isInView ? "animate-bubble-in" : "opacity-0"}`}
                style={{ animationDelay: "0.3s" }}
              >
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-grape-500/20 px-4 py-2.5">
                  <p className="text-sm text-warm-900">점심 김치찌개 8000원</p>
                </div>
              </div>

              {/* Bot response 1 */}
              <div
                className={`flex justify-start ${isInView ? "animate-bubble-in" : "opacity-0"}`}
                style={{ animationDelay: "0.55s" }}
              >
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-warm-300 bg-white px-4 py-3 shadow-sm">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-warm-500">카테고리</span>
                      <span className="font-medium text-warm-900">식비</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-warm-500">금액</span>
                      <span className="font-medium text-warm-900">8,000원</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-warm-500">날짜</span>
                      <span className="font-medium text-warm-900">오늘</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-leaf-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium">저장되었습니다</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User message 2 */}
              <div
                className={`flex justify-end ${isInView ? "animate-bubble-in" : "opacity-0"}`}
                style={{ animationDelay: "0.8s" }}
              >
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-grape-500/20 px-4 py-2.5">
                  <p className="text-sm text-warm-900">어제 택시 15000원 카드로</p>
                </div>
              </div>

              {/* Bot response 2 */}
              <div
                className={`flex justify-start ${isInView ? "animate-bubble-in" : "opacity-0"}`}
                style={{ animationDelay: "1.05s" }}
              >
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-warm-300 bg-white px-4 py-3 shadow-sm">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-warm-500">카테고리</span>
                      <span className="font-medium text-warm-900">교통</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-warm-500">금액</span>
                      <span className="font-medium text-warm-900">15,000원</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-warm-500">결제수단</span>
                      <span className="font-medium text-warm-900">카드</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-leaf-500">
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
