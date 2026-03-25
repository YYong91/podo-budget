# Git 규칙

## 커밋 메시지
- 한국어로 작성
- 형식: `타입: 설명`
- 타입: feat, fix, refactor, test, docs, chore, style
- 예시: `feat: 자연어 지출 파싱 기능 추가`

## 브랜치 전략
- main: 운영 브랜치 (직접 push 금지)
- develop: 개발 브랜치 (feature/fix 브랜치의 머지 대상)
- feature/기능명: 기능 개발 (develop에서 분기)
- fix/버그명: 버그 수정 (develop에서 분기)
- release/x.x.x: 릴리즈 안정화 (develop에서 분기 → main 머지)
- hotfix/xxx: 운영 긴급 수정 (main에서 분기 → main 머지)

## 버전 관리
- SemVer (x.y.z) 기반, 현재 0.x.x (정식 출시 전)
- release → main 머지 시: minor bump (0.6.0 → 0.7.0) — 자동
- hotfix → main 머지 시: patch bump (0.7.0 → 0.7.1) — 자동
- 정식 출시 시 v1.0.0으로 전환

## 워크트리 활용
- 독립 작업은 워크트리로 분리: `git worktree add -b feature/xxx ../podo-budget-xxx develop`
- 워크트리에서 작업 → PR → 머지 후 정리: `git worktree remove ../podo-budget-xxx`
- 워크트리 목록 확인: `git worktree list`

## 작업 워크플로우

```
1. 브랜치 생성      git checkout develop && git pull origin develop
                    git checkout -b feature/xxx
                    (또는 워크트리: git worktree add -b feature/xxx ../podo-budget-xxx develop)

2. 작업 + 커밋      (커밋 전 체크 규칙 준수)

3. 로컬 테스트      cd backend && pytest
                    cd frontend && npm run lint && npm run test:run && npm run build

4. PR 생성          git push -u origin feature/xxx
                    gh pr create --base develop

5. CI 통과 확인     GitHub Actions CI 통과 대기

6. PR 머지          CI 통과 후 머지 (→ develop CD 자동 배포)

7. 정리             git checkout develop && git pull origin develop
                    git branch -d feature/xxx
                    (워크트리: git worktree remove ../podo-budget-xxx)
```

## 릴리즈 플로우

```
1. 릴리즈 분기    git checkout develop && git pull origin develop
                  git checkout -b release/x.x.x

2. 안정화         버그 수정만 (새 기능 X)

3. dev 테스트     release push → dev 환경 자동 배포

4. main 머지      gh pr create --base main
                  CI 통과 후 머지

5. 자동 처리      운영 배포 + vX.X.X 태그 + develop 역머지 PR (모두 자동)

6. 정리           git branch -d release/x.x.x
```

## 핫픽스 플로우

```
1. 핫픽스 분기    git checkout main && git pull origin main
                  git checkout -b hotfix/xxx

2. 수정 + 테스트

3. main 머지      gh pr create --base main
                  CI 통과 후 머지

4. 자동 처리      운영 배포 + vX.X.Z 태그 + develop 역머지 PR (모두 자동)

5. 정리           git branch -d hotfix/xxx
```

## 배포 흐름
- develop/release 머지 → dev 환경 자동 배포 (fly.dev.toml)
- main 머지 → 운영 환경 자동 배포 (fly.toml)
- release/hotfix → main 머지 시 자동 태그 + GitHub Release
- main → develop 역머지 PR 자동 생성
- 배포 시 `alembic upgrade head` 자동 실행 (Fly.io release_command)
