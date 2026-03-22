# 온보딩 웰컴 카드 설계

**이슈**: #80 첫 사용자 온보딩 플로우
**날짜**: 2026-03-23

## 개요
가입 후 빈 홈화면에서 사용자가 뭘 해야 할지 모르는 문제 해결. TransactionList(홈) 상단에 시작 가이드 카드를 표시하여 핵심 기능 안착까지 안내.

## 위치와 표시 조건
- **위치**: TransactionList(홈) 상단, 정기거래 알림 카드 위
- **표시**: 4개 항목 중 미완료가 있고, 사용자가 닫지 않았을 때
- **소멸**: 전부 완료 or "닫기" 클릭
- **저장**: localStorage에 dismissed 상태 저장

## 체크리스트 4개

| 항목 | 완료 판정 | 링크 |
|------|----------|------|
| 첫 거래 입력하기 | 지출 or 수입 1건 이상 | `/expenses/new` |
| 예산 설정하기 | 예산 1건 이상 | `/budgets` |
| 봇 연동하기 | telegram_user_id or kakao_user_id 존재 | `/settings/my-account` |
| 홈화면에 추가하기 | PWA 설치 여부 (standalone 체크) | PWA 설치 프롬프트 |

## 완료 데이터 소스
- **거래**: TransactionList가 이미 불러오는 expenses/income 데이터로 판정 (추가 API 없음)
- **예산**: `/api/budgets` 호출 필요 (가벼움)
- **봇 연동**: `/api/auth/me` 응답의 telegram_user_id/kakao_user_id (AuthContext에 이미 있음)
- **PWA**: `window.matchMedia('(display-mode: standalone)')` 브라우저 API

## UI
- Grape 디자인 시스템 카드 스타일
- 상단에 "시작 가이드" 타이틀 + 진행률 (2/4)
- 각 항목: 체크 아이콘 + 텍스트 + 화살표(링크)
- 완료 항목: 취소선 + 체크 표시
- 우상단 X 닫기 버튼
- 전부 완료 시 축하 메시지 후 자동 소멸

## 제외 (별도 이슈)
- 빈 상태(empty state) 개선 → #85
- PWA 설치 유도 상세 UX → #73
