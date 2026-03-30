import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "포도가계부 - AI가 알아서 분류하는 우리 집 가계부",
  description: "말로 기록하면 AI가 알아서 분류하는 스마트 가계부. 카카오톡, 텔레그램에서 간편하게 지출을 기록하고 가족과 함께 관리하세요.",
  keywords: ["가계부", "AI 가계부", "공유 가계부", "가족 가계부", "지출 관리", "예산 관리"],
  openGraph: {
    title: "포도가계부 - AI가 알아서 분류하는 우리 집 가계부",
    description: "말로 기록하면 AI가 알아서 분류하는 스마트 가계부",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#9333ea",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
