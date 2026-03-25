/**
 * @file ChangelogSection.tsx
 * @description 설정 > 새소식 섹션 — 앱 업데이트 내역 타임라인
 */

import { useEffect } from 'react'
import { useChangelog } from '../../hooks/useChangelog'
import type { ChangelogItem } from '../../data/changelogs'
import SubPageWrapper from './SubPageWrapper'

const TAG_STYLES: Record<ChangelogItem['tag'], string> = {
  '신규': 'bg-grape-100 text-grape-600',
  '개선': 'bg-leaf-100 text-leaf-600',
  '수정': 'bg-[var(--surface-hover)] text-[var(--text-secondary)]',
}

export default function ChangelogSection() {
  const { hasUnread, markAsRead, changelogs } = useChangelog()

  // 새소식 페이지 진입 시 즉시 읽음 처리
  useEffect(() => {
    if (hasUnread) markAsRead()
  }, [hasUnread, markAsRead])

  return (
    <SubPageWrapper>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <div className="space-y-4">
          {changelogs.map((log, idx) => (
            <div
              key={log.version}
              className={`relative pl-6 ${idx < changelogs.length - 1 ? 'pb-4 border-l-2 border-[var(--border-default)] ml-1' : 'ml-1'}`}
            >
              <div className={`absolute left-0 top-1 w-2.5 h-2.5 rounded-full -translate-x-[5px] ${
                idx === 0 ? 'bg-grape-500' : 'bg-warm-300'
              }`} />
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-sm font-bold text-[var(--text-primary)]">v{log.version}</span>
                <span className="text-xs text-[var(--text-muted)]">{log.date}</span>
              </div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">{log.title}</p>
              <ul className="space-y-1">
                {log.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${TAG_STYLES[item.tag]}`}>
                      {item.tag}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SubPageWrapper>
  )
}
