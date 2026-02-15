# E2E 테스트 설계

**날짜**: 2026-02-15
**상태**: 승인됨

## 개요

Playwright로 프론트엔드 E2E 테스트 구축. 핵심 사용자 플로우 4개 영역, ~15개 테스트.

## 구조

```
e2e/
├── playwright.config.ts
├── tests/
│   ├── auth.spec.ts        — 회원가입, 로그인, 리다이렉트
│   ├── expenses.spec.ts    — 지출 CRUD
│   ├── dashboard.spec.ts   — 대시보드 렌더링
│   └── navigation.spec.ts  — 네비게이션, 404
├── fixtures/
│   └── auth.ts             — 로그인 상태 fixture
└── global-setup.ts         — DB 초기화
```

## 테스트 시나리오

- auth: 회원가입, 로그인 성공/실패, 미인증 리다이렉트
- expenses: 폼 모드 생성, 목록 조회, 상세, 수정, 삭제
- dashboard: 빈 상태, 통계+차트, 최근 지출
- navigation: 사이드바 메뉴, 404, 모바일 토글

## CI 통합

GitHub Actions에 e2e-test job 추가. PostgreSQL 서비스 + Backend 백그라운드 시작 + Playwright 실행. 실패 시 스크린샷/트레이스 아티팩트 업로드.

## 제약사항

- LLM API 필요한 자연어 입력은 제외 (폼 모드로 테스트)
- 테스트 전 API로 유저 생성 + 로그인
