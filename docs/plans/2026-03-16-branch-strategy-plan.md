# 브랜치 전략 고도화 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** release/hotfix 브랜치 추가, 자동 버전 태깅, 역머지 자동화로 B2C 서비스 대비 브랜치 전략 고도화

**Architecture:** 기존 CI/CD 워크플로우 트리거를 확장하고, 신규 `release-tag.yml` 워크플로우로 main 머지 시 자동 태깅 + 역머지 PR 생성. 문서(git.md, CLAUDE.md)도 함께 업데이트.

**Tech Stack:** GitHub Actions, gh CLI, git tags, SemVer

---

## 파일 구조

| 파일 | 동작 |
|------|------|
| `.github/workflows/ci.yml` | 수정: branches에 `release/**` 추가 |
| `.github/workflows/deploy-dev.yml` | 수정: branches에 `release/**` 추가 |
| `.github/workflows/release-tag.yml` | **신규**: 자동 태그 + GitHub Release + 역머지 PR |
| `.claude/rules/git.md` | 수정: 브랜치 전략/워크플로우 업데이트 |
| `CLAUDE.md` | 수정: 브랜치 전략 섹션 업데이트 |

---

## Task 1: CI 워크플로우에 release 브랜치 트리거 추가

**Files:**
- Modify: `.github/workflows/ci.yml:4-5`

- [ ] **Step 1: ci.yml branches 수정**

```yaml
on:
  pull_request:
    branches: [develop, main, 'release/**']
  workflow_dispatch:
```

- [ ] **Step 2: 알림 메시지에 release 환경 표시 추가**

ci.yml의 notify-test-start와 notify-test-result에서 `ENV_PREFIX` 로직 수정:

```yaml
# notify-test-start
message: "${{ (github.base_ref == 'main' && '[PROD]') || (startsWith(github.base_ref, 'release/') && '[RELEASE]') || '[DEV]' }} 🧪 podo-budget 테스트 시작\n📝 #${{ github.event.pull_request.number }} ${{ github.event.pull_request.title || 'Manual trigger' }}"

# notify-test-result
ENV_PREFIX: ${{ (github.base_ref == 'main' && '[PROD]') || (startsWith(github.base_ref, 'release/') && '[RELEASE]') || '[DEV]' }}
```

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: CI에 release 브랜치 트리거 추가"
```

---

## Task 2: deploy-dev 워크플로우에 release 브랜치 트리거 추가

**Files:**
- Modify: `.github/workflows/deploy-dev.yml:5-6`

- [ ] **Step 1: deploy-dev.yml branches 수정**

```yaml
on:
  push:
    branches: [develop, 'release/**']
```

- [ ] **Step 2: 알림에 release 구분 추가**

notify-deploy-start:
```yaml
message: "${{ startsWith(github.ref_name, 'release/') && '[RELEASE]' || '[DEV]' }} 🚀 podo-budget 배포 시작"
```

notify-deploy-result 스텝의 환경 변수 추가:
```yaml
ENV_PREFIX: ${{ startsWith(github.ref_name, 'release/') && '[RELEASE]' || '[DEV]' }}
```

결과 메시지에서 `[DEV]` 하드코딩을 `${ENV_PREFIX}`로 교체.

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/deploy-dev.yml
git commit -m "chore: deploy-dev에 release 브랜치 트리거 추가"
```

---

## Task 3: release-tag.yml 신규 워크플로우 생성

**Files:**
- Create: `.github/workflows/release-tag.yml`

- [ ] **Step 1: 워크플로우 파일 생성**

```yaml
# main 머지 시 자동 버전 태그 + GitHub Release + develop 역머지 PR
name: Release Tag

on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  tag-and-backmerge:
    # PR이 머지된 경우에만 실행 (닫기만 한 경우 스킵)
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          fetch-tags: true

      - name: 브랜치 유형 판별
        id: branch-type
        env:
          HEAD_BRANCH: ${{ github.event.pull_request.head.ref }}
        run: |
          echo "head_branch=${HEAD_BRANCH}" >> $GITHUB_OUTPUT
          if [[ "$HEAD_BRANCH" == release/* ]]; then
            echo "type=release" >> $GITHUB_OUTPUT
          elif [[ "$HEAD_BRANCH" == hotfix/* ]]; then
            echo "type=hotfix" >> $GITHUB_OUTPUT
          else
            echo "type=other" >> $GITHUB_OUTPUT
          fi

      - name: 버전 계산
        if: steps.branch-type.outputs.type != 'other'
        id: version
        env:
          BRANCH_TYPE: ${{ steps.branch-type.outputs.type }}
          HEAD_BRANCH: ${{ steps.branch-type.outputs.head_branch }}
        run: |
          # 최신 태그 가져오기 (없으면 v0.0.0)
          LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | head -1)
          if [ -z "$LATEST_TAG" ]; then
            LATEST_TAG="v0.0.0"
          fi

          # 버전 파싱
          VERSION="${LATEST_TAG#v}"
          IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

          # release 브랜치명에서 버전 추출 시도 (release/1.13.0 형식)
          if [ "$BRANCH_TYPE" = "release" ]; then
            BRANCH_VERSION="${HEAD_BRANCH#release/}"
            if [[ "$BRANCH_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
              NEW_VERSION="$BRANCH_VERSION"
            else
              NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
            fi
          elif [ "$BRANCH_TYPE" = "hotfix" ]; then
            NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
          fi

          echo "new_version=${NEW_VERSION}" >> $GITHUB_OUTPUT
          echo "tag=v${NEW_VERSION}" >> $GITHUB_OUTPUT
          echo "계산된 버전: v${NEW_VERSION} (이전: ${LATEST_TAG})"

      - name: Git 태그 생성
        if: steps.branch-type.outputs.type != 'other'
        env:
          TAG: ${{ steps.version.outputs.tag }}
          PR_TITLE: ${{ github.event.pull_request.title }}
        run: |
          git tag -a "$TAG" -m "$PR_TITLE"
          git push origin "$TAG"

      - name: GitHub Release 생성
        if: steps.branch-type.outputs.type != 'other'
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ steps.version.outputs.tag }}
          BRANCH_TYPE: ${{ steps.branch-type.outputs.type }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_TITLE: ${{ github.event.pull_request.title }}
          PR_BODY: ${{ github.event.pull_request.body }}
        run: |
          if [ "$BRANCH_TYPE" = "hotfix" ]; then
            PRERELEASE_FLAG=""
            TITLE="🔧 ${TAG} — Hotfix"
          else
            PRERELEASE_FLAG=""
            TITLE="🚀 ${TAG}"
          fi

          BODY="## ${PR_TITLE}

          ${PR_BODY}

          ---
          PR: #${PR_NUMBER}"

          gh release create "$TAG" \
            --title "$TITLE" \
            --notes "$BODY" \
            $PRERELEASE_FLAG

      - name: develop 역머지 PR 생성
        if: steps.branch-type.outputs.type != 'other'
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ steps.version.outputs.tag }}
        run: |
          # main → develop 역머지 PR 생성
          PR_URL=$(gh pr create \
            --base develop \
            --head main \
            --title "chore: ${TAG} main → develop 역머지" \
            --body "자동 생성된 역머지 PR입니다. 충돌이 없으면 바로 머지해주세요." \
            2>&1) || true

          if echo "$PR_URL" | grep -q "already exists"; then
            echo "역머지 PR이 이미 존재합니다."
          elif echo "$PR_URL" | grep -q "https://"; then
            echo "역머지 PR 생성: $PR_URL"
            # auto-merge 시도
            PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
            gh pr merge "$PR_NUM" --merge --auto 2>/dev/null || echo "auto-merge 설정 실패 (충돌 가능성 — 수동 해결 필요)"
          fi

      - name: 텔레그램 알림
        if: steps.branch-type.outputs.type != 'other'
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          TAG: ${{ steps.version.outputs.tag }}
          BRANCH_TYPE: ${{ steps.branch-type.outputs.type }}
          PR_TITLE: ${{ github.event.pull_request.title }}
        run: |
          if [ "$BRANCH_TYPE" = "hotfix" ]; then
            EMOJI="🔧"
          else
            EMOJI="🏷️"
          fi

          MESSAGE="$(printf '%s %s 릴리즈 태그 생성\n📝 %s\n🔗 https://github.com/%s/releases/tag/%s' \
            "${EMOJI}" "${TAG}" "${PR_TITLE}" "${{ github.repository }}" "${TAG}")"

          curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${MESSAGE}" || true
```

- [ ] **Step 2: 커밋**

```bash
git add .github/workflows/release-tag.yml
git commit -m "feat: release-tag 워크플로우 추가 — 자동 태그 + 역머지"
```

---

## Task 4: changelogs.ts 버전 정리 (0.x.x 전환)

**Files:**
- Modify: `frontend/src/data/changelogs.ts`

관련 이슈: #68 (버전 정책 변경 — 0.x.x 체계로 전환)

기존 1.0.0~1.12.0 (13개)을 주요 마일스톤 기준 6개로 압축:

- [ ] **Step 1: changelogs 배열을 다음으로 교체**

```typescript
export const changelogs: Changelog[] = [
  {
    version: '0.6.0',
    date: '2026-03-16',
    title: '온보딩 개선 + 카카오 봇 강화',
    items: [
      { tag: '신규', text: '카카오톡 봇 /undo(삭제), /change(카테고리 변경) 명령어 추가' },
      { tag: '개선', text: '카카오톡 봇 한글 명령어 지원 — "변경", "취소", "리포트" 등' },
      { tag: '개선', text: '초대받은 가계부에 바로 참여할 수 있습니다' },
      { tag: '수정', text: '새로고침 시 온보딩 페이지가 다시 나오는 문제 수정' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-03-15',
    title: '카카오톡 연동 + 다크모드',
    items: [
      { tag: '신규', text: '카카오톡 채널 봇 계정 연동 — 설정에서 코드 발급 후 /link로 연동' },
      { tag: '신규', text: '다크모드 지원 — 설정에서 라이트/다크/시스템 선택' },
      { tag: '개선', text: '전체 페이지 UI 일관성 개선 — 입력 필드, 버튼, 간격 통일' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-03-14',
    title: '첫 화면 개편 + 종합 리포트',
    items: [
      { tag: '개선', text: '앱을 열면 바로 가계부(거래 내역)가 표시됩니다' },
      { tag: '개선', text: '네비게이션이 4탭으로 간결해졌습니다' },
      { tag: '개선', text: '자산 탭이 순자산 중심 UI로 새롭게 바뀌었습니다' },
      { tag: '신규', text: '종합 재무 리포트 — 재정 건강 점수, AI 심층 분석, 자산 변동 요약' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-03-13',
    title: '가계부 목록 개편 + 설정 정리',
    items: [
      { tag: '개선', text: '토스 스타일 월별 캘린더로 거래 내역을 한눈에 확인' },
      { tag: '개선', text: '지출/수입 금액 탭으로 간편 필터링' },
      { tag: '개선', text: '설정 메뉴 간소화 — 관리 항목을 설정에서 바로 접근' },
      { tag: '신규', text: '새소식 알림 — 설정에서 업데이트 내역 확인' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-02-15',
    title: '정기 거래 + 텔레그램 + 자산 관리',
    items: [
      { tag: '신규', text: '정기 거래 — 매월 반복되는 지출/수입을 자동 기록' },
      { tag: '신규', text: '텔레그램 봇 연동 — 채팅으로 간편 입력' },
      { tag: '신규', text: '자산 관리 — 주식, 코인, 예적금, 부동산, 대출 등' },
      { tag: '신규', text: '피드백 페이지 — 앱 내에서 바로 의견 전송' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-01-15',
    title: 'AI 가계부 + 수입/공유 가계부',
    items: [
      { tag: '신규', text: '자연어 AI 파싱으로 지출 간편 입력' },
      { tag: '신규', text: '카테고리/예산 관리 + 월별 리포트' },
      { tag: '신규', text: '수입 입력/목록/상세 페이지' },
      { tag: '신규', text: '공유 가계부 — 가족과 함께 가계부 공유' },
    ],
  },
]
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/data/changelogs.ts
git commit -m "chore: 버전 정책 0.x.x 전환 + 업데이트 내역 정리 (closes #68)"
```

---

## Task 5: 초기 버전 태그 생성

**Files:** 없음 (git 명령어만)

- [ ] **Step 1: 현재 main에 초기 태그 생성**

```bash
git tag -a v0.6.0 origin/main -m "0.x.x 체계 시작 — 기존 릴리즈 기준점"
git push origin v0.6.0
```

- [ ] **Step 2: GitHub Release 생성**

```bash
gh release create v0.6.0 --target main --title "v0.6.0 — 0.x.x 체계 시작" --notes "브랜치 전략 고도화 + 버전 정책 전환 기준점. 이전 1.x.x 내역을 0.1.0~0.6.0으로 정리."
```

---

## Task 6: git.md 브랜치 전략 문서 업데이트

**Files:**
- Modify: `.claude/rules/git.md`

- [ ] **Step 1: 브랜치 전략 섹션 수정**

```markdown
## 브랜치 전략
- main: 운영 브랜치 (직접 push 금지)
- develop: 개발 브랜치 (feature/fix 브랜치의 머지 대상)
- feature/기능명: 기능 개발 (develop에서 분기)
- fix/버그명: 버그 수정 (develop에서 분기)
- release/x.x.x: 릴리즈 안정화 (develop에서 분기 → main 머지)
- hotfix/xxx: 운영 긴급 수정 (main에서 분기 → main 머지)
```

- [ ] **Step 2: 워크플로우에 릴리즈/핫픽스 플로우 추가**

```markdown
## 릴리즈 플로우

\```
1. 릴리즈 분기    git checkout develop && git pull origin develop
                  git checkout -b release/x.x.x

2. 안정화         버그 수정만 (새 기능 X)

3. dev 테스트     release push → dev 환경 자동 배포

4. main 머지      gh pr create --base main
                  CI 통과 후 머지

5. 자동 처리      운영 배포 + vX.X.X 태그 + develop 역머지 PR (모두 자동)

6. 정리           git branch -d release/x.x.x
\```

## 핫픽스 플로우

\```
1. 핫픽스 분기    git checkout main && git pull origin main
                  git checkout -b hotfix/xxx

2. 수정 + 테스트

3. main 머지      gh pr create --base main
                  CI 통과 후 머지

4. 자동 처리      운영 배포 + vX.X.Z 태그 + develop 역머지 PR (모두 자동)

5. 정리           git branch -d hotfix/xxx
\```
```

- [ ] **Step 3: 배포 흐름 섹션 업데이트**

```markdown
## 배포 흐름
- develop/release 머지 → dev 환경 자동 배포 (fly.dev.toml)
- main 머지 → 운영 환경 자동 배포 (fly.toml)
- release/hotfix → main 머지 시 자동 태그 + GitHub Release
- main → develop 역머지 PR 자동 생성
- 배포 시 `alembic upgrade head` 자동 실행 (Fly.io release_command)
```

- [ ] **Step 4: 커밋**

```bash
git add .claude/rules/git.md
git commit -m "docs: git.md 브랜치 전략 업데이트 — release/hotfix 플로우 추가"
```

---

## Task 7: CLAUDE.md 브랜치 전략 섹션 업데이트

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 브랜치 전략 섹션 수정**

`### 브랜치 전략` 부분을 다음으로 교체:

```markdown
### 브랜치 전략
- `feature/*`, `fix/*` → `develop`에 PR (CI 테스트)
- develop 머지 → 개발환경 자동 배포 (CD)
- `develop` → `release/x.x.x` 분기 → `main` PR → 운영 배포 + 자동 태그 (vX.X.X)
- `hotfix/*` → `main` PR → 운영 배포 + 자동 패치 태그 (vX.X.Z)
- main 머지 시 develop 역머지 PR 자동 생성
```

- [ ] **Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md 브랜치 전략 업데이트"
```
