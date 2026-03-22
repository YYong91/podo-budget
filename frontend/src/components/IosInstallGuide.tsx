/**
 * @file IosInstallGuide.tsx
 * @description iOS Safari PWA 설치 안내 모달
 */

import { Share, PlusSquare, CheckSquare } from 'lucide-react'

interface Props {
  onClose: () => void
}

const steps = [
  { icon: Share, title: '공유 버튼 탭', description: 'Safari 하단의 공유 버튼(□↑)을 탭하세요' },
  { icon: PlusSquare, title: '"홈 화면에 추가" 선택', description: '메뉴에서 "홈 화면에 추가"를 찾아 탭하세요' },
  { icon: CheckSquare, title: '"추가" 탭', description: '오른쪽 상단의 "추가"를 탭하면 완료!' },
]

export default function IosInstallGuide({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div data-testid="ios-guide-backdrop" role="button" tabIndex={0} aria-label="닫기" className="absolute inset-0 bg-black/50" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose() }} />
      <div className="relative bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">앱으로 설치하기</h3>
        <p className="text-sm text-[var(--text-tertiary)] mb-5">Safari에서 홈 화면에 추가하세요</p>
        <div className="space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div key={idx} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-grape-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-grape-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{idx + 1}. {step.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{step.description}</p>
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={onClose} className="mt-6 w-full py-3 bg-grape-600 text-white rounded-xl text-sm font-semibold hover:bg-grape-700 transition-colors">
          확인
        </button>
      </div>
    </div>
  )
}
