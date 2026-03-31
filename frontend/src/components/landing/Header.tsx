import { useEffect, useState } from "react"

export function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-cream/80 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img
              src="/maskable-icon-512x512.png"
              alt="포도가계부 로고"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="text-lg font-bold text-grape-500">포도가계부</span>
          </div>

          {/* Login Button */}
          <button className="rounded-xl border-2 border-grape-500 px-4 py-2 text-sm font-medium text-grape-500 transition-colors hover:bg-grape-500 hover:text-white">
            로그인
          </button>
        </div>
      </div>
    </header>
  )
}
