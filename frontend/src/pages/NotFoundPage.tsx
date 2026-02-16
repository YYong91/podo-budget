import { Link } from 'react-router-dom'
import { Home, SearchX } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <SearchX className="w-16 h-16 text-stone-300 mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-stone-800 mb-2">404</h1>
        <p className="text-lg text-stone-500 mb-8">
          페이지를 찾을 수 없습니다
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-grape-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-grape-700 active:scale-[0.98] transition-all"
        >
          <Home className="w-5 h-5" />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
