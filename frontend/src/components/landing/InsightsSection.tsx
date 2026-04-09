import { useInView } from '../../hooks/useInView'
import { landingScreenshots } from '../../data/landingData'
import { ScreenshotImage } from './ScreenshotImage'

export function InsightsSection() {
  const { ref, isInView } = useInView()

  return (
    <section
      className="relative overflow-hidden py-28"
      style={{ background: "linear-gradient(160deg, #fefce8 0%, #faf5ff 100%)" }}
    >
      {/* 배경 블롭 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-grape-500/5 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-grape-500/10 blur-3xl" />
      </div>

      <div
        ref={ref}
        className="relative mx-auto flex max-w-5xl flex-col items-center px-4 sm:px-6 lg:px-8"
      >
        {/* 헤더 */}
        <div className={`mb-12 text-center ${isInView ? "animate-fade-in-up" : "opacity-0"}`}>
          <span className="mb-4 inline-block rounded-full bg-grape-500/10 px-4 py-1.5 text-sm font-medium text-grape-500">
            모아보기
          </span>
          <h2 className="mt-4 text-2xl font-bold leading-snug text-warm-900 sm:text-3xl md:text-4xl">
            <span className="block">이번 달,</span>
            <span className="block">어디에 얼마 썼지?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-warm-500">
            앱 열면 바로 보여요. 예산 현황, 정기결제 일정, 카테고리별 지출, AI 분석까지.
          </p>
        </div>

        {/* 2x2 카드 격자 */}
        <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto w-full">
          {landingScreenshots.overview.map((item, i) => (
            <div
              key={item.path}
              className={`rounded-2xl border border-warm-200 bg-white shadow-sm overflow-hidden ${isInView ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ animationDelay: `${0.1 * i}s` }}
            >
              <ScreenshotImage
                src={item.path}
                alt={item.alt}
                caption={item.caption}
                className="aspect-[4/3] w-full object-cover"
              />
              <p className="px-3 py-2 text-sm font-medium text-warm-700 text-center">
                {item.caption}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
