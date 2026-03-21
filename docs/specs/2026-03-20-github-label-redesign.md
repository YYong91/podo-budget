# GitHub 이슈 라벨 체계 재설계

## 목표
이슈/프로젝트 관리의 일관성을 확보하고, 에이전트가 이슈를 자율 처리할 때 명확한 분류 기준을 제공한다.

## 설계 원칙
1. **라벨은 변하지 않는 분류용** — 타입, 우선순위, 영역
2. **상태는 Projects 필드로** — Status, Phase (변하는 값)
3. **접두사로 그룹핑** — `priority:`, `area:` 접두사
4. **1인 팀 적정 규모** — 13개 (업계 권장 10~15개)

---

## 새 라벨 체계 (13개)

### Type (5개) — 이슈 종류
| 라벨 | 색상 | HEX | 설명 |
|------|------|-----|------|
| `bug` | 빨강 | #d73a4a | 버그 |
| `feature` | 하늘 | #a2eeef | 새 기능 |
| `improvement` | 초록 | #0e8a16 | 기존 기능 개선, 리팩토링, 성능 |
| `chore` | 회색 | #ededed | 인프라, CI/CD, 의존성, 설정 |
| `docs` | 파랑 | #0075ca | 문서 |

### Priority (3개) — 긴급도
| 라벨 | 색상 | HEX | 설명 |
|------|------|-----|------|
| `priority: high` | 주황 | #d93f0b | 이번 주 안에 |
| `priority: medium` | 노랑 | #fbca04 | 다음 스프린트 |
| `priority: low` | 연파랑 | #c5def5 | 시간 나면 |

### Area (3개) — 코드 영역
| 라벨 | 색상 | HEX | 설명 |
|------|------|-----|------|
| `area: frontend` | 핑크 | #BF0597 | FE (React, TS) |
| `area: backend` | 남색 | #1d76db | BE (FastAPI, Python) |
| `area: infra` | 연초록 | #55BF7F | CI/CD, 배포, DB, 모니터링 |

### Close 사유 (2개)
| 라벨 | 색상 | HEX | 설명 |
|------|------|-----|------|
| `duplicate` | 회색 | #cfd3d7 | 중복 |
| `wontfix` | 흰색 | #ffffff | 안 할 것 |

---

## Projects 필드 (변경 없음)

### Status
```
Backlog → Todo → In Progress → On Dev → Done
```

### Phase
```
Phase 5: 안정화 → Phase 6: 첫 경험 → Phase 7: 리텐션 → Phase 8: 깊이 → Phase 9: 확장
```

---

## 마이그레이션 계획

### 1단계: 새 라벨 생성
```
feature, improvement, chore, docs
priority: high, priority: medium, priority: low
area: frontend, area: backend, area: infra
```

### 2단계: 기존 라벨 → 새 라벨 매핑 (이슈 업데이트)

#### Type 매핑
| 기존 | 새 라벨 | 대상 수 |
|------|--------|---------|
| `enhancement` | `feature` 또는 `improvement` (본문 기반 판단) | 68개 |
| `code-review` | `improvement` | 100개 |
| `code-quality` | `improvement` | 4개 |
| `score-improvement` | `improvement` | 0개 |
| `documentation` | `docs` | 0개 |
| `bug` | 유지 | — |

`enhancement` 68개 분류 기준:
- 제목에 "추가", "신규", "도입" → `feature`
- 제목에 "개선", "리팩토링", "최적화", "정리" → `improvement`
- 제목에 "CI", "배포", "인프라", "워크플로우" → `chore`

#### Priority 매핑
| 기존 | 새 라벨 | 대상 수 |
|------|--------|---------|
| `P0: critical` | `priority: high` | 23개 |
| `P1: high` | `priority: high` | 68개 |
| `P2: medium` | `priority: medium` | 45개 |
| `P3: low` | `priority: low` | 13개 |

#### Phase 라벨 → 삭제 (Projects 필드로 이관 확인 후)
| 기존 | 대상 수 | 처리 |
|------|---------|------|
| `Phase 5` | 120개 | Projects Phase 필드 확인 후 라벨 삭제 |
| `Phase 6` | 8개 | 동일 |
| `Phase 7` | 6개 | 동일 |
| `Phase 8` | 9개 | 동일 |
| `Phase 9` | 11개 | 동일 |

### 3단계: Area 라벨 추가
기존 이슈에 area 라벨 추가:
- 파일 경로 기반: `backend/` → `area: backend`, `frontend/` → `area: frontend`
- CI/CD, 워크플로우, Dockerfile → `area: infra`
- 여러 영역 걸치면 복수 area 가능

### 4단계: 기존 라벨 삭제
삭제 대상 (14개):
```
enhancement, code-review, code-quality, score-improvement, documentation
P0: critical, P1: high, P2: medium, P3: low
Phase 5, Phase 6, Phase 7, Phase 8, Phase 9
good first issue, help wanted, question, invalid
```

### 5단계: `.claude/rules/github.md` 업데이트
새 라벨 체계 + 이슈 생성 규칙 반영

---

## 실행 순서 (안전하게)
1. 새 라벨 생성 (기존 라벨과 공존)
2. 이슈에 새 라벨 추가 (기존 라벨 유지한 채)
3. Projects Phase 필드 데이터 확인
4. 기존 라벨 제거 (이슈에서)
5. 기존 라벨 삭제 (GitHub에서)
6. rules 문서 업데이트
