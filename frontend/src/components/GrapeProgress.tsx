/**
 * 포도알 성장 카드
 * 이번 달 거래 건수를 포도알로 시각화한다.
 * 10개 = 1 포도송이
 */

import { useMemo } from 'react'

interface GrapeProgressProps {
  /** 이번 달 거래 건수 (지출 + 수입) */
  count: number
}

export default function GrapeProgress({ count }: GrapeProgressProps) {
  const bunches = Math.floor(count / 10)
  const remaining = count % 10

  // 포도알 10개 배열 (채워진 것과 빈 것)
  const grapes = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => i < remaining)
  }, [remaining])

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-warm-700">이번 달 포도알</h2>
        <span className="text-sm text-warm-500">
          {bunches > 0 && `🍇 ×${bunches} + `}
          {remaining}/10
        </span>
      </div>

      {/* 포도알 시각화 */}
      <div className="flex items-center justify-center gap-1.5 py-3">
        {grapes.map((filled, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-full transition-all duration-300 ${
              filled
                ? 'bg-grape-600 shadow-sm shadow-grape-300 animate-grape-pop'
                : 'bg-grape-200'
            }`}
            style={filled ? { animationDelay: `${i * 50}ms` } : undefined}
          />
        ))}
      </div>

      {/* 안내 메시지 */}
      <p className="text-center text-sm text-warm-500 mt-2">
        {remaining === 0 && count === 0
          ? '첫 번째 거래를 기록하고 포도알을 심어보세요!'
          : remaining === 0
            ? `🍇 포도송이 ${bunches}개 완성! 다음 송이를 시작하세요`
            : `포도송이까지 ${10 - remaining}개 남았어요`
        }
      </p>

      {/* 완성된 송이 표시 */}
      {bunches > 0 && (
        <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-warm-100">
          {Array.from({ length: Math.min(bunches, 10) }, (_, i) => (
            <span key={i} className="text-lg">🍇</span>
          ))}
          {bunches > 10 && (
            <span className="text-sm text-warm-500 ml-1">+{bunches - 10}</span>
          )}
        </div>
      )}
    </div>
  )
}
