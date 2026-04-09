import { useInView } from '../../hooks/useInView'
import { featureCards } from '../../data/landingData'

function getFeatureIcon(id: string) {
  const icons: Record<string, JSX.Element> = {
    budget: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    recurring: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    payment: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    search: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    ),
    category: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  }
  return icons[id] ?? null
}

export function FeaturesSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative bg-warm-100/30 py-28">
      <div
        ref={ref}
        className="mx-auto flex max-w-5xl flex-col items-center px-4 sm:px-6 lg:px-8"
      >
        {/* 타이틀 */}
        <div
          className={`mb-14 text-center ${isInView ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <span className="mb-4 inline-block rounded-full bg-leaf-500/20 px-4 py-1.5 text-sm font-medium text-leaf-500">
            편의 기능
          </span>
          <h2 className="mt-4 text-2xl font-bold leading-snug text-warm-900 sm:text-3xl md:text-4xl">
            <span className="block">꼼꼼하게,</span>
            <span className="block">더 편리하게</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-warm-500">
            가계부, 이제 손쉽게
          </p>
        </div>

        {/* 기능 카드 그리드 */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature, i) => (
            <div
              key={feature.title}
              className={`group relative overflow-hidden rounded-2xl border border-warm-300 bg-white p-6 shadow-sm transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-grape-400 hover:shadow-lg ${
                isInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${0.08 * (i + 1)}s` }}
            >
              {/* 하이라이트 뱃지 */}
              <span className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-xs font-medium ${feature.highlightBg}`}>
                {feature.highlight}
              </span>

              {/* 아이콘 */}
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${feature.iconBg} ${feature.iconColor}`}
              >
                {getFeatureIcon(feature.id)}
              </div>

              <h3 className="mb-2 text-lg font-semibold text-warm-900">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-warm-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
