# 프로덕션 빌드 최적화 설계

**날짜**: 2026-02-15
**상태**: 승인됨

## 현황

- Dashboard 청크: 360KB (gzip 107KB) — Recharts가 원인
- index vendor 청크: 307KB (gzip 101KB) — Sentry 즉시 로딩 포함
- date-fns: package.json에 있지만 미사용

## 최적화 항목

### 1. date-fns 제거
코드에서 import 없음. package.json에서 제거.

### 2. Sentry 지연 로딩
`import()` 동적 import로 전환. DSN 설정 시에만 로드. ErrorBoundary 조건부 렌더링.

### 3. Recharts → Chart.js 교체
`recharts` 제거, `chart.js` + `react-chartjs-2` 설치. Dashboard PieChart/LineChart 교체. Amber/Stone 테마 유지.

## 예상 결과
- Dashboard 청크: 360KB → ~60KB
- index vendor: 307KB → ~240KB
- 총 gzip ~33% 감소
