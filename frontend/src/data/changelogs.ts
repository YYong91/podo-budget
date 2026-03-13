/**
 * @file changelogs.ts
 * @description 앱 업데이트 내역 데이터.
 *   새 업데이트를 추가할 때 배열 맨 앞에 추가하세요 (최신순).
 */

export interface ChangelogItem {
  tag: '신규' | '개선' | '수정'
  text: string
}

export interface Changelog {
  version: string
  date: string
  title: string
  items: ChangelogItem[]
}

export const changelogs: Changelog[] = [
  {
    version: '1.5.0',
    date: '2026-03-13',
    title: '설정 페이지 개편',
    items: [
      { tag: '개선', text: '설정 페이지 개편 — 새소식·관리·내 계정 3개 메뉴로 정리' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-03-12',
    title: '업데이트 알림 기능',
    items: [
      { tag: '신규', text: '새소식 알림 — 설정 페이지에서 앱 업데이트 내역을 확인할 수 있습니다' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-02-23',
    title: '자산 관리 & 피드백',
    items: [
      { tag: '신규', text: '자산 관리 — 주식, 코인, 예적금, 부동산, 대출 등 자산을 한 곳에서 관리' },
      { tag: '신규', text: '피드백 페이지 — 앱 내에서 바로 의견을 보낼 수 있습니다' },
      { tag: '개선', text: '설정 페이지 관리 메뉴 정리' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-02-15',
    title: '정기 거래 & 텔레그램',
    items: [
      { tag: '신규', text: '정기 거래 — 매월 반복되는 지출/수입을 자동 기록' },
      { tag: '신규', text: '텔레그램 봇 연동 — 채팅으로 간편 입력' },
      { tag: '개선', text: '대시보드에 정기 거래 알림 카드 추가' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-02-01',
    title: '수입 관리 & 공유 가계부',
    items: [
      { tag: '신규', text: '수입 입력/목록/상세 페이지' },
      { tag: '신규', text: '공유 가계부 — 가족과 함께 가계부 공유' },
      { tag: '신규', text: '리포트 지출/수입 토글' },
      { tag: '개선', text: '대시보드 수입/순수익 카드 추가' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-15',
    title: '포도가계부 출시',
    items: [
      { tag: '신규', text: '자연어 AI 파싱으로 지출 간편 입력' },
      { tag: '신규', text: '카테고리/예산 관리' },
      { tag: '신규', text: '월별 리포트 & 인사이트' },
      { tag: '신규', text: '포도알 성장 메타포' },
    ],
  },
]
