/**
 * @file navItems.ts
 * @description 사이드바와 탭바에서 공유하는 네비게이션 항목 정의
 * 아이콘·이름을 한 곳에서 관리하여 두 UI 간 불일치 방지
 */
import { NotebookPen, BookOpenText, Ellipsis, Landmark } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FEATURES } from '../config/features'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/home', label: '가계부', icon: NotebookPen },
  ...(FEATURES.assets ? [{ path: '/assets', label: '자산', icon: Landmark }] : []),
  { path: '/insights', label: '모아보기', icon: BookOpenText },
  { path: '/settings', label: '더보기', icon: Ellipsis },
]
