#!/bin/bash
# HomeNRich Frontend 배포 스크립트
# 사용법: cd frontend && ../scripts/deploy-frontend.sh

set -e

echo "🎨 HomeNRich Frontend 배포를 시작합니다..."

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 위치 확인
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ frontend 디렉토리에서 실행해주세요.${NC}"
    exit 1
fi

# 2. Backend URL 확인
echo -e "\n${YELLOW}[1/4] Backend URL 입력${NC}"
read -p "Backend URL (예: https://homenrich-backend.fly.dev): " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo -e "${RED}❌ Backend URL이 필요합니다.${NC}"
    exit 1
fi

# 3. Frontend 앱 생성
echo -e "\n${YELLOW}[2/4] Frontend 앱 생성...${NC}"
read -p "Frontend 앱 이름 (기본: homenrich-frontend): " FRONTEND_NAME
FRONTEND_NAME=${FRONTEND_NAME:-homenrich-frontend}

if flyctl apps list | grep -q "$FRONTEND_NAME"; then
    echo -e "${YELLOW}⚠️  Frontend 앱이 이미 존재합니다. 건너뜁니다.${NC}"
else
    flyctl launch \
        --name "$FRONTEND_NAME" \
        --region nrt \
        --no-deploy
fi

# 4. 환경 변수 설정
echo -e "\n${YELLOW}[3/4] 환경 변수 설정...${NC}"
flyctl secrets set \
    BACKEND_URL="$BACKEND_URL" \
    --app "$FRONTEND_NAME"

# 5. 배포
echo -e "\n${YELLOW}[4/4] 배포 중...${NC}"
flyctl deploy \
    --remote-only \
    --build-arg VITE_API_URL=/api \
    --app "$FRONTEND_NAME"

echo -e "${GREEN}✅ Frontend 배포 완료!${NC}"

# 6. URL 출력
FRONTEND_URL="https://${FRONTEND_NAME}.fly.dev"
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 HomeNRich 배포 완료!${NC}"
echo -e "\nFrontend URL: ${FRONTEND_URL}"
echo -e "Backend URL:  ${BACKEND_URL}"
echo -e "\n${YELLOW}다음 단계:${NC}"
echo -e "1. 브라우저에서 ${FRONTEND_URL} 접속"
echo -e "2. Backend CORS 업데이트:"
echo -e "   flyctl secrets set CORS_ORIGINS=${FRONTEND_URL} --app \$(basename $BACKEND_URL .fly.dev)"
echo -e "3. (선택) 커스텀 도메인 설정: DEPLOYMENT.md 참고"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
