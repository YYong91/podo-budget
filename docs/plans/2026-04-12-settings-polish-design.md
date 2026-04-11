# 더보기 페이지 3라운드 정비 디자인

**날짜**: 2026-04-12
**목표**: 더보기에서 진입 가능한 9개 페이지를 3라운드로 체계적으로 정비

---

## 스코프

| # | 페이지 | 파일 |
|---|--------|------|
| 1 | SettingsPage (메인) | `pages/SettingsPage.tsx` |
| 2 | CategoryManager | `pages/CategoryManager.tsx` |
| 3 | BudgetManager | `pages/BudgetManager.tsx` |
| 4 | PaymentMethodManager | `pages/PaymentMethodManager.tsx` |
| 5 | RecurringList | `pages/RecurringList.tsx` |
| 6 | HouseholdListPage | `pages/HouseholdListPage.tsx` |
| 7 | AppearanceSection | `components/settings/AppearanceSection.tsx` |
| 8 | MyAccountSection | `components/settings/MyAccountSection.tsx` |
| 9 | ChangelogSection | `components/settings/ChangelogSection.tsx` |

---

## Round 1 — 숫자/금액 포맷

전체 9페이지에서 금액/숫자 표시 방식을 통일한다.

- `₩` 접두사 통일 (없는 곳 추가)
- `toLocaleString('ko-KR')` 쉼표 포맷 적용 (누락된 곳)
- 금액 표시 요소에 `tabular-nums tracking-tight` 클래스 적용 (가계부 홈과 동일)
- "원" suffix vs `₩` prefix 혼용 정리 — 금액은 `₩0,000원` 또는 `0,000원` 형태로 통일

## Round 2 — UX + 용어

전체 9페이지에서 사용성과 문구를 점검한다.

- 버튼/라벨 텍스트 통일 ("저장" vs "완료" vs "확인" 혼용 정리)
- 빈 상태(EmptyState) 메시지 점검 — 누락 또는 불친절한 표현
- 삭제/취소 등 위험 액션의 확인 흐름 점검
- 용어 불일치 정리 ("반복 거래" vs "정기거래" 등)
- 로딩/에러 상태 누락 여부

## Round 3 — 디자인 톤

전체 9페이지에서 시각적 일관성을 확보한다.

- 페이지 헤더 구조 통일 (뒤로가기 버튼 + 아이콘 + 타이틀 패턴)
- 카드/리스트 아이템 여백 통일
- 버튼 스타일 통일 (primary/secondary/destructive 역할별)
- 섹션 구분선, 그룹 헤더 스타일 통일

---

## 진행 방식

- 라운드별로 전체 9페이지 스캔 → 수정 → 커밋
- 각 라운드 완료 후 변경 사항 보고 및 리뷰
- 브랜치: `feature/settings-polish` (develop 기반 워크트리)
