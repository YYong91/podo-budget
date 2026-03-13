# Git 규칙

## 커밋 메시지
- 한국어로 작성
- 형식: `타입: 설명`
- 타입: feat, fix, refactor, test, docs, chore, style
- 예시: `feat: 자연어 지출 파싱 기능 추가`

## 브랜치
- main: 안정 브랜치 (직접 push 금지)
- feature/기능명: 기능 개발
- fix/버그명: 버그 수정

## 작업 워크플로우 (필수)

모든 코드 변경은 아래 프로세스를 따른다:

```
1. 브랜치 생성      git checkout main && git pull origin main
                    git checkout -b feature/xxx

2. 작업 + 커밋      (커밋 전 체크 규칙 준수)

3. 로컬 테스트      cd backend && pytest
                    cd frontend && npm run lint && npm run test:run && npm run build

4. PR 생성          git push -u origin feature/xxx
                    gh pr create

5. CI 통과 확인     GitHub Actions CI 통과 대기

6. PR 머지          CI 통과 후 머지 (→ CD 자동 배포)

7. 정리             git checkout main && git pull origin main
                    git branch -d feature/xxx
```

- PR 생성 전에 반드시 로컬에서 전체 테스트를 통과시킨다
- main에는 PR을 통해서만 코드가 들어간다 (branch protection)
- 머지 후 반드시 로컬 브랜치를 정리하고 main으로 돌아간다
