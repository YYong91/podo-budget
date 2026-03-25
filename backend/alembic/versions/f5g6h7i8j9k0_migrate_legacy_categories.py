"""migrate legacy categories to system categories

Revision ID: f5g6h7i8j9k0
Revises: e4f5g6h7i8j9
Create Date: 2026-03-23

기존 사용자/가구 카테고리를 시스템 카테고리로 통합 (#330)
- 이름이 비슷한 기존 카테고리의 FK를 시스템 카테고리로 이전
- 이전 후 빈 기존 카테고리 삭제
- CategoryMapping seed로 LLM이 이전 이름을 인식하도록
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f5g6h7i8j9k0"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = "e4f5g6h7i8j9"  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 기존 카테고리 이름 → 시스템 카테고리 이름 매핑
LEGACY_TO_SYSTEM = {
    "교통비": "교통",
    "교육비": "교육/자기계발",
    "의료비": "의료/건강",
    "통신비": "통신",
    "주거비": "주거/관리비",
    "생필품비": "생활용품",
    "외식비": "식비",
    "문화생활비": "문화/여가",
    "경조사회비": "경조사",
    "쇼핑": "의류/미용",
    "여행": "문화/여가",
    "기타 비용": "기타",
    "기타 수입": "기타수입",
    "전세이자 지원": "용돈/지원",
    "식사": "식비",
    "술/간식": "카페/음료",
    "소모품": "생활용품",
    "장보기": "식비",
    "용돈": "용돈",
    "저축성지출": "저축/투자",
}

# FK 이전 대상 테이블
FK_TABLES = ("expenses", "incomes", "budgets", "recurring_transactions")


def _relink_and_delete(conn, old_id: int, new_id: int) -> int:
    """기존 카테고리의 모든 FK를 시스템 카테고리로 이전 후 삭제. 이전 건수 반환."""
    total = 0
    for table in FK_TABLES:
        result = conn.execute(
            sa.text(f"UPDATE {table} SET category_id = :new WHERE category_id = :old"),  # noqa: S608
            {"new": new_id, "old": old_id},
        )
        total += result.rowcount

    # category_mappings의 target도 이전
    conn.execute(
        sa.text("UPDATE category_mappings SET target_category_id = :new WHERE target_category_id = :old"),
        {"new": new_id, "old": old_id},
    )
    # 기존 카테고리 삭제
    conn.execute(sa.text("DELETE FROM categories WHERE id = :id"), {"id": old_id})
    return total


def upgrade() -> None:
    conn = op.get_bind()

    # 시스템 카테고리 ID 조회
    sys_cats = conn.execute(sa.text("SELECT id, name FROM categories WHERE user_id IS NULL AND household_id IS NULL")).fetchall()
    sys_id_by_name = {row[1]: row[0] for row in sys_cats}

    migrated_total = 0

    for old_name, sys_name in LEGACY_TO_SYSTEM.items():
        sys_id = sys_id_by_name.get(sys_name)
        if sys_id is None:
            continue

        # 이 이름의 비시스템 카테고리 전부 조회
        old_cats = conn.execute(
            sa.text("SELECT id FROM categories WHERE name = :name AND NOT (user_id IS NULL AND household_id IS NULL)"),
            {"name": old_name},
        ).fetchall()

        for (old_id,) in old_cats:
            count = _relink_and_delete(conn, old_id, sys_id)
            migrated_total += count

    # CategoryMapping seed — LLM이 이전 이름으로 분류해도 시스템 카테고리로 매핑
    households = conn.execute(sa.text("SELECT id FROM households")).fetchall()
    for (hh_id,) in households:
        for old_name, sys_name in LEGACY_TO_SYSTEM.items():
            if old_name == sys_name:
                continue  # 이름이 같으면 매핑 불필요
            sys_id = sys_id_by_name.get(sys_name)
            if sys_id is None:
                continue
            existing = conn.execute(
                sa.text("SELECT id FROM category_mappings WHERE source_name = :src AND household_id = :hh"),
                {"src": old_name, "hh": hh_id},
            ).fetchone()
            if existing is None:
                conn.execute(
                    sa.text("INSERT INTO category_mappings (household_id, user_id, source_name, target_category_id) VALUES (:hh, NULL, :src, :target)"),
                    {"hh": hh_id, "src": old_name, "target": sys_id},
                )


def downgrade() -> None:
    # 데이터 마이그레이션은 되돌릴 수 없음 (FK가 이미 이전됨)
    # downgrade 시 매핑만 삭제
    conn = op.get_bind()
    for old_name in LEGACY_TO_SYSTEM:
        conn.execute(
            sa.text("DELETE FROM category_mappings WHERE source_name = :src"),
            {"src": old_name},
        )
