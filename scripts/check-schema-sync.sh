#!/usr/bin/env bash
# FE↔BE 스키마 동기화 검증 스크립트
#
# BE OpenAPI 스펙에서 TypeScript 타입을 자동 생성하고,
# FE 수동 타입 정의와의 구조적 호환성을 tsc로 검증한다.
#
# 사용법:
#   ./scripts/check-schema-sync.sh
#
# 필요 조건:
#   - uv (Python 패키지 매니저)
#   - Node.js + npm (frontend 의존성 설치 상태)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPENAPI_JSON="$PROJECT_ROOT/frontend/openapi.json"
GENERATED_TYPES="$PROJECT_ROOT/frontend/src/types/generated-api.ts"

echo "🔍 FE↔BE 스키마 동기화 검증 시작"
echo ""

# Step 1: BE OpenAPI 스펙 추출
echo "📋 Step 1: BE OpenAPI 스펙 추출..."
cd "$PROJECT_ROOT"
PYTHONPATH=backend uv run python scripts/extract-openapi.py "$OPENAPI_JSON"
echo ""

# Step 2: openapi-typescript로 타입 생성
echo "📋 Step 2: TypeScript 타입 생성..."
cd "$PROJECT_ROOT/frontend"
npx openapi-typescript "$OPENAPI_JSON" -o "$GENERATED_TYPES" 2>&1
echo ""

# Step 3: tsc로 타입 호환성 검증
echo "📋 Step 3: 타입 호환성 검증 (tsc)..."
cd "$PROJECT_ROOT/frontend"

# schema-sync-check.ts를 별도 tsconfig로 검증 (프로젝트 tsconfig와 독립)
npx tsc \
  --noEmit \
  --strict \
  --moduleResolution bundler \
  --module esnext \
  --target esnext \
  --skipLibCheck \
  scripts/schema-sync-check.ts

echo ""
echo "✅ 스키마 동기화 검증 통과 — FE 타입이 BE 스펙과 호환됩니다."
