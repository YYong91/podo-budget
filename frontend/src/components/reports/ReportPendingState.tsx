/**
 * @file ReportPendingState.tsx
 * @description 결산 리포트가 pending/processing 상태일 때 표시하는 컴포넌트
 * 리포트 생성이 완료될 때까지 잠시 기다리도록 안내한다.
 */

export default function ReportPendingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
      <span className="text-4xl animate-bounce">📬</span>
      <p className="font-semibold text-[var(--text-primary)]">결산 리포트를 준비하고 있어요</p>
      <p className="text-sm text-[var(--text-secondary)]">잠시 후 자동으로 업데이트돼요</p>
    </div>
  )
}
