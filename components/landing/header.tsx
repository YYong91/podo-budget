"use client"

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
          ? "bg-background/80 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-primary-foreground"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="8" r="3" fill="currentColor" />
                <circle cx="7" cy="14" r="3" fill="currentColor" />
                <circle cx="17" cy="14" r="3" fill="currentColor" />
                <circle cx="12" cy="18" r="2" fill="currentColor" />
                <path d="M12 2v3" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-lg font-bold text-primary">포도가계부</span>
          </div>

          {/* Login Button */}
          <button className="rounded-xl border-2 border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
            로그인
          </button>
        </div>
      </div>
    </header>
  )
}
