import { useInView } from '../../hooks/useInView'
import { ScreenshotImage } from './ScreenshotImage'
import { landingScreenshots } from '../../data/landingData'

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
            쉽고 빠른 입력
          </span>
          <h2 className="text-2xl font-bold leading-snug text-warm-900 sm:text-3xl md:text-4xl">
            <span className="block">한 줄이면 끝,</span>
            <span className="block">나머지는 AI가</span>
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-warm-500 md:mt-6 md:text-lg">
            사용하던 메신저로 보내도 되고, 앱에서 바로 입력해도 돼요. 카테고리, 날짜, 결제수단은 AI가 알아서 분류해줘요.
          </p>

          {/* Input Method Icons */}
          <div className="mt-8 flex items-center gap-3">
            {/* 메신저 아이콘 */}
            <div className="flex items-center gap-2 rounded-full bg-warm-100 px-4 py-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-warm-700" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-sm font-medium text-warm-700">메신저</span>
            </div>
            {/* 앱 아이콘 */}
            <div className="flex items-center gap-2 rounded-full bg-warm-100 px-4 py-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-warm-700" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-warm-700">앱에서 바로</span>
            </div>
          </div>
        </div>

        {/* Visual Area — 두 가지 입력 방식 나란히 */}
        <div
          className={`flex flex-1 flex-col items-start justify-center gap-4 sm:flex-row ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          {/* 왼쪽 카드: 채팅 목업 */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-full rounded-2xl border border-warm-200 bg-white p-5 shadow-lg overflow-hidden">
              {/* Chat Header */}
              <div className="mb-4 flex items-center gap-3 border-b border-warm-200 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-grape-500">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
                    <circle cx="12" cy="8" r="3" fill="currentColor" />
                    <circle cx="7" cy="14" r="3" fill="currentColor" />
                    <circle cx="17" cy="14" r="3" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-warm-900">포도가계부</p>
                  <p className="text-xs text-warm-500">AI 가계부 봇</p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-3">
                {/* 사용자 메시지 */}
                <div
                  className={`flex justify-end ${isInView ? "animate-bubble-in" : "opacity-0"}`}
                  style={{ animationDelay: "0.3s" }}
                >
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-grape-500/20 px-3 py-2">
                    <p className="text-sm text-warm-900">남편이랑 저녁 파스타 32000원</p>
                  </div>
                </div>

                {/* 봇 응답 */}
                <div
                  className={`flex justify-start ${isInView ? "animate-bubble-in" : "opacity-0"}`}
                  style={{ animationDelay: "0.55s" }}
                >
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-warm-200 bg-white px-3 py-2.5 shadow-sm">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-warm-500">카테고리</span>
                        <span className="font-medium text-warm-900">식비</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-warm-500">금액</span>
                        <span className="font-medium text-warm-900">32,000원</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-warm-500">날짜</span>
                        <span className="font-medium text-warm-900">오늘</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-leaf-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-medium">기록됐어요</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-warm-500 text-center">메신저로 보내기</p>
          </div>

          {/* 오른쪽 카드: 앱 스크린샷 */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-full rounded-2xl border border-warm-200 overflow-hidden">
              <ScreenshotImage
                src={landingScreenshots.input.app.path}
                alt={landingScreenshots.input.app.alt}
                caption="앱에서 바로 입력"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-3 text-sm font-medium text-warm-500 text-center">앱에서 바로 입력</p>
          </div>
        </div>
      </div>
    </section>
  )
}
