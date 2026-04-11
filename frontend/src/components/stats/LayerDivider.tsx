interface LayerDividerProps {
  label: string
}

export default function LayerDivider({ label }: LayerDividerProps) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="flex-1 h-px bg-[var(--border-default)]" />
      <span className="text-xs font-medium text-[var(--text-tertiary)] shrink-0">{label}</span>
      <div className="flex-1 h-px bg-[var(--border-default)]" />
    </div>
  )
}
