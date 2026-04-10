import { useState } from 'react'

type ScreenshotImageProps = {
  src: string
  alt: string
  caption?: string
  className?: string
}

export function ScreenshotImage({ src, alt, caption, className = '' }: ScreenshotImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-grape-200 to-grape-400 ${className}`}
        role="img"
        aria-label={alt}
      >
        {caption && (
          <span className="text-sm font-medium text-white drop-shadow-sm">
            {caption}
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`rounded-2xl ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}
