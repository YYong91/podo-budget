#!/bin/bash

# HomeNRich 백엔드 테스트 실행 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}HomeNRich 백엔드 테스트 시작${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# 가상환경 활성화 확인
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo -e "${YELLOW}Warning: 가상환경이 활성화되지 않았습니다.${NC}"
    echo -e "${YELLOW}다음 명령어로 활성화 후 재실행하세요:${NC}"
    echo -e "${YELLOW}  source venv/bin/activate${NC}"
    echo ""
fi

# aiosqlite 설치 확인
echo -e "${YELLOW}[1/4] aiosqlite 패키지 확인 중...${NC}"
if ! python -c "import aiosqlite" 2>/dev/null; then
    echo -e "${YELLOW}aiosqlite가 설치되지 않았습니다. 설치합니다...${NC}"
    pip install -q aiosqlite==0.19.0
    echo -e "${GREEN}✓ aiosqlite 설치 완료${NC}"
else
    echo -e "${GREEN}✓ aiosqlite 이미 설치됨${NC}"
fi
echo ""

# 테스트 종류 선택
TEST_TYPE="${1:-all}"

case "$TEST_TYPE" in
    unit)
        echo -e "${YELLOW}[2/4] 단위 테스트만 실행합니다...${NC}"
        TEST_PATH="tests/unit/"
        ;;
    integration)
        echo -e "${YELLOW}[2/4] 통합 테스트만 실행합니다...${NC}"
        TEST_PATH="tests/integration/"
        ;;
    e2e)
        echo -e "${YELLOW}[2/4] E2E 테스트만 실행합니다...${NC}"
        TEST_PATH="tests/e2e/"
        ;;
    all)
        echo -e "${YELLOW}[2/4] 전체 테스트를 실행합니다...${NC}"
        TEST_PATH="tests/"
        ;;
    *)
        echo -e "${RED}Error: 잘못된 테스트 타입입니다.${NC}"
        echo "사용법: ./run_tests.sh [unit|integration|e2e|all]"
        exit 1
        ;;
esac
echo ""

# pytest 실행
echo -e "${YELLOW}[3/4] pytest 실행 중...${NC}"
echo ""

if pytest "$TEST_PATH" -v; then
    echo ""
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}✓ 모든 테스트 통과!${NC}"
    echo -e "${GREEN}=====================================${NC}"
    EXIT_CODE=0
else
    echo ""
    echo -e "${RED}=====================================${NC}"
    echo -e "${RED}✗ 테스트 실패${NC}"
    echo -e "${RED}=====================================${NC}"
    EXIT_CODE=1
fi
echo ""

# 커버리지 리포트 (선택사항)
if [[ "$2" == "--cov" ]]; then
    echo -e "${YELLOW}[4/4] 커버리지 리포트 생성 중...${NC}"
    pytest "$TEST_PATH" --cov=app --cov-report=html --cov-report=term
    echo -e "${GREEN}✓ 커버리지 리포트: htmlcov/index.html${NC}"
else
    echo -e "${YELLOW}[4/4] 커버리지 생략 (--cov 옵션으로 실행 가능)${NC}"
fi

exit $EXIT_CODE
