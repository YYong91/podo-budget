#!/usr/bin/env python3
"""BE OpenAPI 스펙을 JSON 파일로 추출하는 스크립트.

BE 서버를 실행하지 않고 FastAPI app 인스턴스에서 직접 OpenAPI 스키마를 추출합니다.
CI에서 FE 타입과의 동기화 검증에 사용됩니다.

Usage:
    PYTHONPATH=backend python scripts/extract-openapi.py [output_path]
"""

import json
import sys
from pathlib import Path


def main() -> None:
    output_path = sys.argv[1] if len(sys.argv) > 1 else "frontend/openapi.json"

    # FastAPI app에서 OpenAPI 스키마 추출
    from app.main import app

    schema = app.openapi()

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n")

    # 요약 출력
    paths = schema.get("paths", {})
    schemas = schema.get("components", {}).get("schemas", {})
    endpoint_count = sum(len(methods) for methods in paths.values())
    print(f"✅ OpenAPI 스펙 추출 완료: {output_path}")
    print(f"   엔드포인트: {endpoint_count}개, 스키마: {len(schemas)}개")


if __name__ == "__main__":
    main()
