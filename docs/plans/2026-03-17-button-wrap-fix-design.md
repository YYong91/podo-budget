# #66 모바일 버튼 줄바꿈 버그 수정 설계

## 현상
지출/수입 상세 페이지에서 "반복 거래 등록" 버튼이 모바일에서 텍스트 줄바꿈됨.

## 원인
3개 버튼(반복 거래 등록, 수정, 삭제)에 `flex-1`이 적용되어 균등 분배 → 긴 텍스트가 줄바꿈.

## 수정
- `flex-1 sm:flex-none` → `shrink-0 whitespace-nowrap` 로 변경 (반복 거래 등록 버튼)
- 수정/삭제 버튼도 동일하게 `flex-1 sm:flex-none` → `shrink-0` 적용
- 부모 flex 컨테이너가 `gap`과 `flex-wrap`으로 자연스럽게 배치

## 대상 파일
- `frontend/src/pages/ExpenseDetail.tsx` L179
- `frontend/src/pages/IncomeDetail.tsx` L165
