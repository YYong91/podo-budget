interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[var(--skeleton-base)] rounded-lg ${className}`}
      {...props}
    />
  )
}

export function SkeletonCircle({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[var(--skeleton-base)] rounded-full ${className}`}
      {...props}
    />
  )
}
