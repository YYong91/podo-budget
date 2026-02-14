# 빌드 단계
FROM node:22-alpine AS build

WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
ARG VITE_API_URL=/api
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=production
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
ENV VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT}
RUN npm run build

# 실행 단계 (Nginx)
FROM nginx:alpine

# 빌드 결과물 복사
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx 설정 템플릿 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# 기본 백엔드 URL (docker-compose용)
ENV BACKEND_URL=http://backend:8000

EXPOSE 80

# envsubst로 BACKEND_URL만 치환 후 nginx 시작
CMD ["/bin/sh", "-c", "sed 's|BACKEND_URL_PLACEHOLDER|'\"$BACKEND_URL\"'|g' /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
