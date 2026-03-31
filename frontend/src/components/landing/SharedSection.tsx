import { useInView } from '../../hooks/useInView'

const members = [
  { name: "엄마", initials: "엄", color: "bg-grape-100 text-grape-700", border: "border-grape-200" },
  { name: "아빠", initials: "아", color: "bg-leaf-100 text-leaf-700", border: "border-leaf-200" },
  { name: "나",   initials: "나", color: "bg-yellow-100 text-yellow-700", border: "border-yellow-200" },
]

const transactions = [
  { member: "엄마", color: "bg-grape-100 text-grape-700", text: "김치찌개 8,000원", time: "방금 전",   rotate: "-rotate-2", pos: "left-0 -top-6" },
  { member: "아빠", color: "bg-leaf-100 text-leaf-700", text: "지하철 50,000원",  time: "3분 전",   rotate: "rotate-2",  pos: "right-0 top-4" },
  { member: "나",   color: "bg-yellow-100 text-yellow-700", text: "문구류 12,000원",  time: "10분 전",  rotate: "-rotate-1", pos: "left-4 bottom-0" },
]

export function SharedSection() {
  const { ref, isInView } = useInView()

  return (
    <section className="relative overflow-hidden bg-cream py-28">
      <div
        ref={ref}
        className="mx-auto flex max-w-4xl flex-col items-center px-4 sm:px-6 lg:px-8"
      >
        {/* Text — centre aligned */}
        <div
          className={`text-center ${isInView ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <span className="mb-4 inline-block rounded-full bg-grape-500/10 px-4 py-1.5 text-sm font-medium text-grape-500">
            공유 가계부
          </span>
          <h2 className="mt-4 text-2xl font-bold leading-snug text-warm-900 sm:text-3xl md:text-4xl">
            <span className="block">가족이 함께 쓰는</span>
            <span className="block">하나의 가계부</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-warm-500">
            가구를 만들고 가족을 초대하세요.
            <br />
            누가 얼마를 썼는지 한눈에 파악할 수 있어요.
          </p>
        </div>

        {/* Visual — avatar cluster + floating transaction cards */}
        <div
          className={`relative mt-16 flex h-72 w-full max-w-lg items-center justify-center ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          {/* Soft glow behind avatars */}
          <div className="absolute h-48 w-48 rounded-full bg-grape-500/10 blur-3xl" />

          {/* Overlapping avatars */}
          <div className="relative flex items-center">
            {members.map((m, i) => (
              <div
                key={i}
                className={`relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-cream text-2xl font-bold shadow-lg ${m.color} ${
                  i !== 0 ? "-ml-5" : ""
                }`}
                style={{ zIndex: members.length - i }}
              >
                {m.initials}
                {/* name chip */}
                <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-warm-900 shadow-sm border border-warm-300">
                  {m.name}
                </span>
              </div>
            ))}
          </div>

          {/* Floating transaction cards */}
          {transactions.map((t, i) => (
            <div
              key={i}
              className={`absolute ${t.pos} ${t.rotate} ${
                isInView ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${0.35 + i * 0.15}s` }}
            >
              <div className="flex items-center gap-2 rounded-2xl border border-warm-300 bg-white px-4 py-3 shadow-lg">
                <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${t.color}`}>
                  {t.member[0]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-warm-900">{t.text}</p>
                  <p className="text-xs text-warm-500">{t.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom feature tags */}
        <div
          className={`mt-20 flex flex-wrap justify-center gap-3 ${
            isInView ? "animate-fade-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.5s" }}
        >
          {["실시간 동기화", "멤버별 내역", "역할 구분", "초대 링크"].map((tag) => (
            <span
              key={tag}
              className="rounded-xl border border-warm-300 bg-white px-4 py-2 text-sm text-warm-500 shadow-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
