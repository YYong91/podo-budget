import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Receipt, Wallet } from 'lucide-react'

export default function FloatingActionButton() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleAction = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div ref={ref} className="fixed bottom-20 md:bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* 팝오버 메뉴 */}
      {open && (
        <div className="flex flex-col gap-2 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <button
            onClick={() => handleAction('/expenses/new')}
            className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white rounded-2xl shadow-lg border border-warm-200 hover:bg-grape-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-grape-100 flex items-center justify-center">
              <Receipt className="w-4.5 h-4.5 text-grape-600" />
            </div>
            <span className="text-sm font-medium text-warm-800">지출 입력</span>
          </button>
          <button
            onClick={() => handleAction('/income/new')}
            className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white rounded-2xl shadow-lg border border-warm-200 hover:bg-leaf-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-leaf-100 flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5 text-leaf-600" />
            </div>
            <span className="text-sm font-medium text-warm-800">수입 입력</span>
          </button>
        </div>
      )}

      {/* FAB 메인 버튼 */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? '입력 메뉴 닫기' : '지출/수입 입력'}
        className={`
          w-14 h-14 rounded-full shadow-lg flex items-center justify-center
          transition-all duration-200
          ${open
            ? 'bg-warm-600 hover:bg-warm-700 rotate-0'
            : 'bg-grape-600 hover:bg-grape-700'
          }
        `}
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <Plus className="w-6 h-6 text-white" />
        }
      </button>
    </div>
  )
}
