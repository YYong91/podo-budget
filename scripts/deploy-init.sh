#!/bin/bash
# HomeNRich 초기 배포 자동화 스크립트
# 사용법: ./scripts/deploy-init.sh

set -e  # 에러 발생 시 중단

echo "🚀 HomeNRich 배포 초기 설정을 시작합니다..."

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Fly CLI 설치 확인
echo -e "\n${YELLOW}[1/8] Fly CLI 확인...${NC}"
if ! command -v flyctl &> /dev/null; then
    echo -e "${RED}❌ Fly CLI가 설치되지 않았습니다.${NC}"
    echo "설치 방법: brew install flyctl"
    exit 1
fi
echo -e "${GREEN}✅ Fly CLI 설치 확인 완료${NC}"

# 2. 로그인 확인
echo -e "\n${YELLOW}[2/8] Fly.io 로그인 확인...${NC}"
if ! flyctl auth whoami &> /dev/null; then
    echo -e "${RED}❌ Fly.io에 로그인되지 않았습니다.${NC}"
    echo "로그인: flyctl auth login"
    exit 1
fi
echo -e "${GREEN}✅ 로그인 확인 완료${NC}"

# 3. PostgreSQL 생성
echo -e "\n${YELLOW}[3/8] PostgreSQL 데이터베이스 생성...${NC}"
read -p "DB 이름 (기본: homenrich-db): " DB_NAME
DB_NAME=${DB_NAME:-homenrich-db}

if flyctl apps list | grep -q "$DB_NAME"; then
    echo -e "${YELLOW}⚠️  DB가 이미 존재합니다. 건너뜁니다.${NC}"
else
    flyctl postgres create \
        --name "$DB_NAME" \
        --region nrt \
        --vm-size shared-cpu-1x \
        --volume-size 3 \
        --initial-cluster-size 1

    echo -e "${GREEN}✅ PostgreSQL 생성 완료${NC}"
    echo -e "${YELLOW}⚠️  위에 출력된 연결 정보를 안전하게 저장하세요!${NC}"
fi

# 4. Backend 앱 생성
echo -e "\n${YELLOW}[4/8] Backend 앱 생성...${NC}"
read -p "Backend 앱 이름 (기본: homenrich-backend): " BACKEND_NAME
BACKEND_NAME=${BACKEND_NAME:-homenrich-backend}

cd backend

if flyctl apps list | grep -q "$BACKEND_NAME"; then
    echo -e "${YELLOW}⚠️  Backend 앱이 이미 존재합니다. 건너뜁니다.${NC}"
else
    flyctl launch \
        --name "$BACKEND_NAME" \
        --region nrt \
        --no-deploy

    echo -e "${GREEN}✅ Backend 앱 생성 완료${NC}"
fi

# 5. DB 연결
echo -e "\n${YELLOW}[5/8] Backend와 DB 연결...${NC}"
if flyctl postgres attach "$DB_NAME" --app "$BACKEND_NAME" --yes; then
    echo -e "${GREEN}✅ DB 연결 완료${NC}"
else
    echo -e "${YELLOW}⚠️  DB가 이미 연결되어 있을 수 있습니다.${NC}"
fi

# 6. Backend 환경 변수 설정
echo -e "\n${YELLOW}[6/8] Backend 환경 변수 설정...${NC}"

read -p "Anthropic API Key: " ANTHROPIC_KEY
read -p "Telegram Bot Token: " TELEGRAM_TOKEN
read -p "Kakao Bot API Key: " KAKAO_KEY
read -p "프론트엔드 도메인 (기본: https://homenrich-frontend.fly.dev): " FRONTEND_URL
FRONTEND_URL=${FRONTEND_URL:-https://homenrich-frontend.fly.dev}

# SECRET_KEY 자동 생성
SECRET_KEY=$(openssl rand -hex 32)

flyctl secrets set \
    SECRET_KEY="$SECRET_KEY" \
    LLM_PROVIDER=anthropic \
    ANTHROPIC_API_KEY="$ANTHROPIC_KEY" \
    TELEGRAM_BOT_TOKEN="$TELEGRAM_TOKEN" \
    KAKAO_BOT_API_KEY="$KAKAO_KEY" \
    DEBUG=False \
    CORS_ORIGINS="$FRONTEND_URL" \
    --app "$BACKEND_NAME"

echo -e "${GREEN}✅ 환경 변수 설정 완료${NC}"

# 7. Backend 배포
echo -e "\n${YELLOW}[7/8] Backend 배포 중...${NC}"
flyctl deploy --remote-only --app "$BACKEND_NAME"
echo -e "${GREEN}✅ Backend 배포 완료${NC}"

# 8. DB 마이그레이션
echo -e "\n${YELLOW}[8/8] DB 마이그레이션 실행...${NC}"
flyctl ssh console --app "$BACKEND_NAME" --command "uv run alembic upgrade head"
echo -e "${GREEN}✅ 마이그레이션 완료${NC}"

# 9. 헬스체크
echo -e "\n${YELLOW}헬스체크 확인 중...${NC}"
sleep 5
BACKEND_URL="https://${BACKEND_NAME}.fly.dev"
if curl -s "$BACKEND_URL/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Backend 정상 동작 확인${NC}"
else
    echo -e "${RED}❌ Backend 헬스체크 실패${NC}"
    echo "로그 확인: flyctl logs --app $BACKEND_NAME"
fi

# 10. Frontend 배포 안내
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Backend 배포 완료!${NC}"
echo -e "\nBackend URL: ${BACKEND_URL}"
echo -e "\n${YELLOW}다음 단계: Frontend 배포${NC}"
echo -e "cd ../frontend"
echo -e "./deploy-frontend.sh"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd ..
