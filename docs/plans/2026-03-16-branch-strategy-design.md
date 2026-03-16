# 브랜치 전략 고도화 디자인

**작성일**: 2026-03-16
**목표**: B2C 서비스 대비 브랜치 전략 고도화 — hotfix 경로, 선택적 릴리즈, 버전 관리 자동화

---

## 배경

현재 `feature/* → develop → main` 2단 구조로 운영 중이나 다음 문제가 있다:

1. **핫픽스 경로 부재** — 운영 긴급 수정 시 develop을 거쳐야 해서 느림
2. **선택적 배포 불가** — develop에 머지된 기능이 모두 다음 배포에 포함됨
3. **버전 관리 부재** — 릴리즈 태깅/이력이 없어 롤백 기준이 불명확

## 제약 조건

- 1인 개발 + Claude Code worktree 병렬 개발
- 기능 단위 릴리즈 (정기 주기 아님)
- 환경: dev (Fly.io + Cloudflare Pages) / prod (동일 스택)
- 추가 환경(staging) 비용 부담 없이 운영

---

## 1. 브랜치 구조

```
feature/*  ─┐
fix/*      ─┤──→ develop ──→ release/x.x.x ──→ main
hotfix/*   ─────────────────────────────────────→ main (+ develop 역머지)
```

| 브랜치 | 분기점 | 머지 대상 | 용도 |
|--------|--------|-----------|------|
| `feature/*` | develop | develop | 기능 개발 |
| `fix/*` | develop | develop | 버그 수정 |
| `release/x.x.x` | develop | main + develop 역머지 | 릴리즈 안정화 |
| `hotfix/*` | main | main + develop 역머지 | 운영 긴급 수정 |

## 2. 릴리즈 플로우

### 일상 개발

```
feature/xxx → develop PR → CI → 머지 → dev 환경 자동 배포
```

### 릴리즈

```
1. develop에서 release/x.x.x 분기
2. dev 환경에 자동 배포 (deploy-dev.yml 트리거)
3. 안정화 수정 커밋 (필요시)
4. main PR → CI → 머지
5. 운영 배포 (자동) + vX.X.X 태그 (자동) + develop 역머지 PR (자동)
6. release 브랜치 삭제
```

- release 브랜치에서는 버그 수정만 허용, 새 기능 추가 금지
- release 기간 중 develop에서 다음 기능 개발 계속 가능

### 핫픽스

```
1. main에서 hotfix/xxx 분기
2. 수정 + 테스트
3. main PR → CI → 머지
4. 운영 배포 (자동) + vX.X.Z 태그 (자동) + develop 역머지 PR (자동)
5. hotfix 브랜치 삭제
```

## 3. 버전 관리

SemVer (x.y.z) 기반:

| 버전 변경 | 시점 | 예시 |
|-----------|------|------|
| major (x) | 호환 안 되는 큰 변경 | 1.0.0 → 2.0.0 |
| minor (y) | release 브랜치 → main 머지 | 1.12.0 → 1.13.0 |
| patch (z) | hotfix → main 머지 | 1.13.0 → 1.13.1 |

**태깅 자동화**: main 머지 시 머지된 브랜치명을 감지하여 자동 계산
- `release/*` → 최신 태그에서 minor bump
- `hotfix/*` → 최신 태그에서 patch bump
- 그 외 → 태그 안 함

## 4. CI/CD 파이프라인 변경

### 트리거 변경

| 워크플로우 | 현재 | 변경 후 |
|-----------|------|---------|
| `ci.yml` | PR → develop, main | PR → develop, main, `release/**` |
| `deploy-dev.yml` | push → develop | push → develop, `release/**` |
| `cd.yml` | push → main | push → main (변경 없음) |

### 신규 워크플로우: `release-tag.yml`

**트리거**: main에 push (머지)

**동작**:
1. 머지된 PR의 head 브랜치명 확인
2. `release/*` → minor bump, `hotfix/*` → patch bump, 그 외 → skip
3. 최신 git tag에서 버전 자동 계산
4. `gh release create vX.X.X` — GitHub Release 생성
5. main → develop 역머지 PR 자동 생성
   - 충돌 없으면: auto-merge
   - 충돌 있으면: PR만 생성 + 텔레그램 알림

## 5. 테스트 환경

- **dev 환경을 develop과 release가 겸용** — release 브랜치 push 시 dev 환경에 배포
- staging 환경은 추가하지 않음 (1인 개발, release 기간 짧음)
- 팀 확장 시 staging 환경 분리 검토

## 6. 변경 필요한 파일

| 파일 | 변경 내용 |
|------|-----------|
| `.github/workflows/ci.yml` | branches에 `release/**` 추가 |
| `.github/workflows/deploy-dev.yml` | branches에 `release/**` 추가 |
| `.github/workflows/release-tag.yml` | **신규** — 자동 태그 + 역머지 PR |
| `.claude/rules/git.md` | 브랜치 전략 업데이트 |
| `CLAUDE.md` | 브랜치 전략 섹션 업데이트 |
