# 포도가계부 로드맵 (Roadmap)

**최종 업데이트**: 2026-03-16
**기준 문서**: `PRODUCT.md`

---

## 완료된 Phase

<details>
<summary>Phase 1~4 (완료) — 클릭하여 펼치기</summary>

### Phase 1: Core MVP (개인 가계부) ✅
자연어 지출 입력 + LLM 자동 분류 + 프리뷰/수정 플로우

### Phase 2: Household Sharing (공유 가계부) ✅
가구 공유, 멤버별 필터링, 초대, 컨텍스트 탐지

### Phase 3: Bot Integration (메신저 봇) ✅
Telegram/Kakao 봇 자연어 입력 + Household 연동

### Phase 4: 배포 및 Beta ✅
Fly.io + Cloudflare Pages 배포, CI/CD, Sentry 연동

</details>

---

## Phase 5: 안정화 + 출시 준비

**목표**: 버그 수정, 법적 요건 충족, 기본 품질 확보. 테스터 → 정식 사용자 전환 준비.
**키워드**: 신뢰, 품질, 법적 기반
**검증**: 본인 + 가족 1~2명 실사용. 매일 직접 써보면서 버그 잡기. 아직 남한테 보여줄 단계 아님.

### podo-budget

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#66](https://github.com/YYong91/podo-budget/issues/66) | 모바일 '반복 거래 등록' 버튼 줄바꿈 버그 | bug |
| [#72](https://github.com/YYong91/podo-budget/issues/72) | 풀-투-리프레시 PWA 전용 고도화 | bug |
| [#86](https://github.com/YYong91/podo-budget/issues/86) | 개인정보 처리방침 / 이용약관 | P0 |
| [#68](https://github.com/YYong91/podo-budget/issues/68) | 버전 정책 0.x.x 전환 + 내역 정리 | 정비 |
| [#71](https://github.com/YYong91/podo-budget/issues/71) | 하단 탭 순서/명칭 UX 검토 | 정비 |
| [#74](https://github.com/YYong91/podo-budget/issues/74) | 전반적 성능 최적화 | 정비 |
| [#75](https://github.com/YYong91/podo-budget/issues/75) | Sentry 모니터링 관리 체계 | 정비 |
| [#85](https://github.com/YYong91/podo-budget/issues/85) | 에러/빈 상태 UX 일관성 | 정비 |

### podo-auth

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#2](https://github.com/YYong91/podo-auth/issues/2) | 포도가계부 전용 모드 — 포도책장 비활성화 | 정비 |
| [#3](https://github.com/YYong91/podo-auth/issues/3) | 다크모드 UI — 포도가계부 스타일 통일 | 정비 |

---

## Phase 6: 첫 사용자 경험 (가입 → 정착)

**목표**: 사용자가 들어와서 안착하게 만드는 것. 가입 → 첫 입력 → "이거 괜찮네" 순간까지의 퍼널 최적화.
**키워드**: 온보딩, 측정, 피드백 루프
**선행 조건**: Phase 5 (법적 요건, 기본 품질)
**검증**: 가까운 지인 5~10명에게 링크 공유. 설명 없이 가입→첫 입력까지 되는지 관찰. 옆에서 쓰는 걸 보거나 화면 공유하면서 관찰하는 게 말로 피드백 받는 것보다 10배 유용.

### podo-budget

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#78](https://github.com/YYong91/podo-budget/issues/78) | 사용자 행동 분석 트래킹 (Analytics) | P1 |
| [#80](https://github.com/YYong91/podo-budget/issues/80) | 첫 사용자 온보딩 플로우 | P1 |
| [#73](https://github.com/YYong91/podo-budget/issues/73) | PWA 설치 유도 UX | P1 |
| [#83](https://github.com/YYong91/podo-budget/issues/83) | 앱 내 사용자 피드백 채널 | P1 |
| [#91](https://github.com/YYong91/podo-budget/issues/91) | 공유가계부 초대 UX 개선 | P1 |
| [#67](https://github.com/YYong91/podo-budget/issues/67) | 공유가계부 미읽음 표시 (빨간 점) | P1 |

### podo-auth

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#5](https://github.com/YYong91/podo-auth/issues/5) | 기본 계정 관리 (비밀번호 변경, 탈퇴 등) | P1 |

> **핵심 지표**: 가입 → 첫 입력 전환율, 7일 리텐션

---

## Phase 7: 리텐션 + 입력 편의 (매일 쓰게 만들기)

**목표**: "3일 쓰고 안 씀" 문제 해결. 입력을 쉽게, 돌아올 이유를 만들기.
**키워드**: 습관, 편의, 스마트
**선행 조건**: Phase 6 (Analytics로 효과 측정 가능)
**검증**: 지인 20~30명 (지인의 지인 포함), 2주 이상 운영. 카톡 오픈채팅/텔레그램 그룹으로 피드백 수집. 3일/7일/14일차 입력 건수 추이 관찰. "안 쓰게 된 이유"를 직접 물어보기. **30일 리텐션 20% 이상 나오면 다음 단계.**

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#82](https://github.com/YYong91/podo-budget/issues/82) | 리텐션 장치 — 리마인더, 주간 리포트, 연속 기록 | P1 |
| [#88](https://github.com/YYong91/podo-budget/issues/88) | 자주 쓰는 내역 즐겨찾기/템플릿 | P2 |
| [#87](https://github.com/YYong91/podo-budget/issues/87) | 거래 내역 검색 | P2 |
| [#93](https://github.com/YYong91/podo-budget/issues/93) | LLM 분류 피드백 루프 | P2 |
| [#95](https://github.com/YYong91/podo-budget/issues/95) | 정기결제 자동 감지 | P2 |

> **핵심 지표**: DAU/MAU 비율, 30일 리텐션, 일평균 입력 건수

---

## Phase 8: 데이터 활용 + 스마트 기능 (깊이)

**목표**: 쌓인 데이터로 가치를 만드는 단계. "써보니까 도움이 된다" 체감.
**키워드**: 인사이트, 자산, 목표
**선행 조건**: Phase 7 (충분한 데이터 축적)
**검증**: SNS 소프트 런칭, 50~100명. 개발자 커뮤니티에 "사이드 프로젝트" 글, 재테크 커뮤니티에 "커플/부부 공유 가계부" 글. 모르는 사람이 가치를 느끼는지, 자발적 피드백/기능 요청이 오는지 관찰. 가입 전환율 측정.

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#92](https://github.com/YYong91/podo-budget/issues/92) | 거래 내역 태그 시스템 | P2 |
| [#90](https://github.com/YYong91/podo-budget/issues/90) | 예산 진단 — 카테고리 성격 기반 | P2 |
| [#97](https://github.com/YYong91/podo-budget/issues/97) | 저축 목표 + 포도송이 시각화 | P2 |
| [#89](https://github.com/YYong91/podo-budget/issues/89) | 가구 대시보드 — 우리 집 재정 현황 | P2 |
| [#100](https://github.com/YYong91/podo-budget/issues/100) | 소비 예측 — 패턴 기반 예상 지출 | P2 |
| [#103](https://github.com/YYong91/podo-budget/issues/103) | 할부 관리 — 잔여 횟수/금액 추적 | P2 |
| [#69](https://github.com/YYong91/podo-budget/issues/69) | 데이터 마이그레이션 — CSV 가져오기 | P2 |
| [#79](https://github.com/YYong91/podo-budget/issues/79) | 데이터 내보내기 (CSV/Excel) | P2 |
| [#77](https://github.com/YYong91/podo-budget/issues/77) | 자산 — 주식 실시간 가격 연동 | P2 |

> **핵심 지표**: 리포트 조회율, 예산 설정율, 목표 생성 수

---

## Phase 9: 확장 + 앱 출시 (스케일업)

**목표**: 네이티브 앱 출시, 바이럴 기능, 인프라 고도화. 테스터 → 일반 사용자 확장.
**키워드**: 성장, 바이럴, 안정성
**선행 조건**: Phase 7~8 핵심 기능 안정화
**검증**: 앱스토어/플레이스토어 출시. 인스타/블로그 마케팅 + 연말 결산 카드 등 바이럴 기능으로 자연 유입. Phase 8에서 모르는 사람의 리텐션이 검증된 상태여야 함.

### 인프라 + 인증

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#76](https://github.com/YYong91/podo-budget/issues/76) | 정식 출시 대비 인프라 보강 (AWS 등) | P3 |
| [#70](https://github.com/YYong91/podo-budget/issues/70) | 앱 푸시 알림 설계 | P3 |
| [podo-auth #4](https://github.com/YYong91/podo-auth/issues/4) | 소셜 로그인 + 이메일 인증 | P3 |

### 바이럴 + 감성

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#94](https://github.com/YYong91/podo-budget/issues/94) | 연말 결산 리포트 — 공유 카드 | P3 |
| [#104](https://github.com/YYong91/podo-budget/issues/104) | 소비 성향 유형 테스트 | P3 |
| [#98](https://github.com/YYong91/podo-budget/issues/98) | 절약 챌린지 — 가구 멤버 동기부여 | P3 |

### 고급 기능

| 이슈 | 제목 | 유형 |
|------|------|------|
| [#102](https://github.com/YYong91/podo-budget/issues/102) | 음성 입력 | P3 |
| [#96](https://github.com/YYong91/podo-budget/issues/96) | 거래 메모 사진 첨부 | P3 |
| [#99](https://github.com/YYong91/podo-budget/issues/99) | 또래 소비 비교 — 익명 통계 | P3 |
| [#101](https://github.com/YYong91/podo-budget/issues/101) | 연말정산 도우미 (검토) | P3 |
| [#81](https://github.com/YYong91/podo-budget/issues/81) | 접근성(a11y) | P3 |
| [#84](https://github.com/YYong91/podo-budget/issues/84) | PWA 오프라인 지원 | P3 |

---

## 전체 흐름 요약

```
Phase    질문                          검증 대상         규모
─────────────────────────────────────────────────────────────
  5      "제대로 동작하는가?"          본인 + 가족       2~3명
  6      "들어와서 안착하는가?"        가까운 지인       5~10명
  7      "매일 쓰는가?"               넓은 지인         20~30명
  8      "쓸수록 도움이 되는가?"       SNS/커뮤니티      50~100명
  9      "다른 사람에게 추천하는가?"   앱스토어          일반 공개
```

각 Phase는 이전 단계의 핵심 지표가 일정 수준에 도달해야 다음으로 넘어간다.
Phase 간 병렬 진행 가능하나, 리소스 분산 주의.

---

## 참조 문서

- **프로덕트 정의**: `PRODUCT.md`
- **구현 현황**: `IMPLEMENTATION_STATUS.md`
- **이슈 보드**: [GitHub Issues](https://github.com/YYong91/podo-budget/issues)
- **podo-auth 이슈**: [GitHub Issues](https://github.com/YYong91/podo-auth/issues)
