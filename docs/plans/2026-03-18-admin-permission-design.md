# #113 가구 관리자 권한 확장 설계

## 목표
owner/admin이 같은 가구 내 모든 거래를 수정/삭제할 수 있도록 권한 확장. member는 본인 거래만.

## 백엔드 변경

### expenses.py PUT/DELETE
1. household_id로 expense 조회 (user_id 필터 제거)
2. 본인 거래면 허용
3. 본인이 아니면 가구 역할 체크 → admin/owner면 허용, member면 403

### income.py PUT/DELETE
동일 패턴.

### 에러 응답
- 권한 없음: 403 "이 항목을 수정할 권한이 없습니다"
- 존재하지 않음: 404 (기존)

## 프론트엔드 변경

### ExpenseDetail.tsx / IncomeDetail.tsx
- 403 응답 시 토스트 "이 항목을 수정할 권한이 없습니다"

## 문서 변경
- PRODUCT.md D4 업데이트
