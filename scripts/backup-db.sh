#!/usr/bin/env bash
# DB 백업 스크립트 — pg_dump로 백업 생성 후 로컬 저장 (#255)
#
# 사용법:
#   ./scripts/backup-db.sh [fly-app-name]
#   BACKUP_DIR=/tmp/db-backups ./scripts/backup-db.sh podo-budget-backend
#
# 환경변수:
#   FLY_APP      Fly.io 앱 이름 (기본: 인자 또는 podo-budget-backend)
#   BACKUP_DIR   백업 저장 디렉토리 (기본: ./backups)
#   DB_NAME      데이터베이스 이름 (기본: podo_budget)
#   PROXY_PORT   fly proxy 로컬 포트 (기본: 15432)
#   RETENTION_DAYS  백업 보관 일수 (기본: 7)
#
# 필수 도구:
#   - flyctl (fly CLI)
#   - pg_dump (PostgreSQL client)
#   - gzip

set -euo pipefail

# --- 설정 ---
FLY_APP="${1:-${FLY_APP:-podo-budget-backend}}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${DB_NAME:-podo_budget}"
PROXY_PORT="${PROXY_PORT:-15432}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${FLY_APP}_${TIMESTAMP}.sql.gz"

# fly proxy PID 추적 — 스크립트 종료 시 정리
PROXY_PID=""

cleanup() {
  if [ -n "$PROXY_PID" ]; then
    kill "$PROXY_PID" 2>/dev/null || true
    echo "INFO: fly proxy 프로세스 정리 완료 (PID: $PROXY_PID)"
  fi
}
trap cleanup EXIT

# --- 사전 검증 ---
for cmd in fly pg_dump gzip; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "ERROR: '$cmd' 명령어를 찾을 수 없습니다. 설치 후 다시 시도하세요."
    exit 1
  fi
done

mkdir -p "$BACKUP_DIR"

echo "=== DB 백업 시작 ==="
echo "  앱: ${FLY_APP}"
echo "  DB: ${FLY_APP}-db / ${DB_NAME}"
echo "  저장: ${BACKUP_FILE}"
echo ""

# --- DB 연결 확인 ---
echo "1/4 DB 연결 확인 중..."
if ! fly postgres connect -a "${FLY_APP}-db" -c "SELECT 1" > /dev/null 2>&1; then
  echo "ERROR: DB 연결 실패."
  echo "  - 'fly auth login'으로 인증 상태를 확인하세요."
  echo "  - 앱 이름이 올바른지 확인하세요: ${FLY_APP}-db"
  echo "  - 'fly status -a ${FLY_APP}-db'로 DB 상태를 확인하세요."
  exit 1
fi
echo "  DB 연결 확인 완료"

# --- fly proxy 시작 ---
echo "2/4 fly proxy 시작 (localhost:${PROXY_PORT} -> 5432)..."
fly proxy "${PROXY_PORT}:5432" -a "${FLY_APP}-db" &
PROXY_PID=$!

# proxy가 준비될 때까지 대기 (최대 10초)
for i in $(seq 1 10); do
  if pg_isready -h localhost -p "$PROXY_PORT" > /dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "ERROR: fly proxy가 10초 내에 준비되지 않았습니다."
    exit 1
  fi
  sleep 1
done
echo "  fly proxy 준비 완료"

# --- pg_dump 실행 ---
echo "3/4 pg_dump 실행 중..."
if ! pg_dump "postgresql://postgres@localhost:${PROXY_PORT}/${DB_NAME}" | gzip > "$BACKUP_FILE"; then
  echo "ERROR: pg_dump 실패. 백업 파일을 삭제합니다."
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "  백업 완료: ${BACKUP_FILE} (${BACKUP_SIZE})"

# --- 오래된 백업 정리 ---
echo "4/4 ${RETENTION_DAYS}일 이상 된 백업 정리 중..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete 2>/dev/null | wc -l | tr -d ' ')
if [ "$DELETED_COUNT" -gt 0 ]; then
  echo "  ${DELETED_COUNT}개 오래된 백업 삭제 완료"
else
  echo "  정리할 백업 없음"
fi

echo ""
echo "=== 백업 완료 ==="
echo "  파일: ${BACKUP_FILE}"
echo "  크기: ${BACKUP_SIZE}"
echo ""
echo "복원 방법:"
echo "  gunzip -c ${BACKUP_FILE} | fly postgres connect -a ${FLY_APP}-db -d ${DB_NAME}"
