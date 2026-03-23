"""타임스탬프 일관성 검증 테스트 (#310)

모든 모델의 created_at/updated_at/joined_at 컬럼이
server_default=func.now()와 nullable=False를 가지는지 확인합니다.
"""

# 모든 모델이 import되어 Base.metadata에 등록되도록 보장
import app.models  # noqa: F401
from app.core.database import Base

# 타임스탬프 컬럼명 목록
TIMESTAMP_COLUMNS = {"created_at", "updated_at", "joined_at"}

# 예외: responded_at, left_at, deleted_at 등은 nullable이어야 하므로 제외


def test_all_timestamp_columns_have_server_default():
    """모든 모델의 타임스탬프 컬럼에 server_default가 설정되어야 한다"""
    missing = []
    for table_name, table in Base.metadata.tables.items():
        if table_name == "alembic_version":
            continue
        for col in table.columns:
            if col.name in TIMESTAMP_COLUMNS and col.server_default is None:
                missing.append(f"{table_name}.{col.name}")
    assert not missing, f"server_default 누락: {missing}"


def test_all_timestamp_columns_are_not_nullable():
    """모든 모델의 타임스탬프 컬럼이 nullable=False여야 한다"""
    nullable = []
    for table_name, table in Base.metadata.tables.items():
        if table_name == "alembic_version":
            continue
        for col in table.columns:
            if col.name in TIMESTAMP_COLUMNS and col.nullable:
                nullable.append(f"{table_name}.{col.name}")
    assert not nullable, f"nullable=True인 타임스탬프: {nullable}"
