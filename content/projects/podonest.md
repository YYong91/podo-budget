---
title: "podonest: 가족 멀티서비스 SSO 아키텍처"
description: "podo-auth를 허브로 3개 서비스가 JWT 하나로 연결되는 홈서버 기반 가족 앱 플랫폼"
date: 2026-02-22
tags: ["FastAPI", "React", "SSO", "JWT", "OAuth", "PostgreSQL", "SQLite", "Docker", "System Architecture", "Multi-user Architecture", "TDD", "Telegram Bot", "Security", "Testing"]
weight: 3
mermaid: true
---

## 개요

홈서버에서 운영하는 세 개의 가족용 앱(독서 기록, 가계부, 인증 허브)을 단일 계정으로 연결하는 플랫폼입니다. 각 서비스가 독립적으로 개발되어 있고 DB 스키마도 다르기 때문에, 기존 데이터를 깨지 않고 SSO를 붙이는 것이 핵심 과제였습니다.

[... existing sections on service structure, tech stack, Shadow User pattern, etc ...]

## 주요 작업

- **2026-02-22**: Telegram 계정 연동 방식 교체 — 평문 비밀번호 전송(`/link username password`)을 일회용 코드 방식으로 대체, podo-budget PR #8 머지
- **2026-02-22**: Telegram 연동 TDD — 8개 테스트 선작성 후 구현, podo-budget 누적 테스트 378개 달성
- **2026-02-22**: 프론트엔드·백엔드 테스트 인프라 구축 — Vitest + React Testing Library(podo-bookshelf, podo-budget), pytest 85개+ 추가
- **2026-02-22**: 홈서버 자동 배포 설정 — git `post-merge` 훅으로 `git pull` 시 `docker compose up -d --build` 자동 실행
- **2026-02-21**: 3개 서비스 인증 흐름 전체 분석 — auth_user_id(BigInt) vs budget.users.id(Integer) PK 불일치 문제 확인, 7개 도메인 모델의 FK 의존성 파악
- **2026-02-21**: Shadow User 패턴 설계 — podo-budget SSO 전환 방안 확정
- **2026-02-21**: 가족 공유 모델 정의 — podo-bookshelf 읽기/쓰기 권한 구조 재설계

## Telegram 계정 연동 보안 개선

기존 방식은 Telegram 채팅창에 `/link username password`를 입력하는 구조였습니다. Telegram 서버를 경유하는 채팅에 평문 비밀번호가 노출되는 문제가 있었습니다.

일회용 코드 방식으로 교체한 설계는 다음과 같습니다.

| 항목 | 기존 방식 | 변경 후 |
|------|-----------|---------|
| 인증 수단 | `/link username password` (평문) | 6자리 대문자+숫자 일회용 코드 |
| 유효 시간 | 없음 (상시 유효) | 15분 |
| 사용 후 처리 | 없음 | 즉시 삭제 |
| 비밀번호 노출 | Telegram 서버 경유 평문 전송 | 없음 |

신규 API 엔드포인트:

- `POST /api/auth/telegram-link-code` — 코드 발급, DB에 해시 저장
- `DELETE /api/auth/telegram/link` — 연동 해제

프론트엔드 설정 페이지에 코드 생성 버튼, 클립보드 복사, 만료 시각 표시, 연동 해제 버튼을 추가했습니다. DB 마이그레이션으로 `telegram_link_code`, `telegram_link_code_expires_at` 컬럼을 추가했습니다.

## 테스트 인프라 및 배포 자동화

각 서비스별 테스트 커버리지를 확보하고, 홈서버 배포 과정의 수동 작업을 제거했습니다.

**프론트엔드 (Vitest + React Testing Library)**
- podo-bookshelf, podo-budget 양쪽에 테스트 추가

**백엔드 (pytest)**
- 서비스 전반에 85개 이상 테스트 신규 추가
- podo-budget 누적 378개 (Telegram 연동 기능은 테스트 선작성 후 구현)

**배포 자동화**
- 홈서버에 git `post-merge` 훅 설치
- `git pull` 실행 시 `docker compose up -d --build` 자동 트리거
- 수동 SSH 접속 후 재시작 과정 제거
