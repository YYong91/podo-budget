"""seed system categories and relink existing data

Revision ID: d367e7848291
Revises: r1s2t3u4v5w6
Create Date: 2026-03-22 23:18:33.771920

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d367e7848291"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = "r1s2t3u4v5w6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 시스템 카테고리 마스터
SYSTEM_CATEGORIES = [
    # 지출 (sort_order: 높을수록 상위)
    {"name": "식비", "type": "expense", "description": "식료품, 외식, 배달", "sort_order": 18},
    {"name": "카페/음료", "type": "expense", "description": "커피, 음료, 디저트", "sort_order": 17},
    {"name": "교통", "type": "expense", "description": "대중교통, 택시, 주유", "sort_order": 16},
    {"name": "주거/관리비", "type": "expense", "description": "월세, 관리비, 수도광열비", "sort_order": 15},
    {"name": "통신", "type": "expense", "description": "휴대폰, 인터넷", "sort_order": 14},
    {"name": "생활용품", "type": "expense", "description": "일용품, 가전, 가구", "sort_order": 13},
    {"name": "의류/미용", "type": "expense", "description": "옷, 신발, 미용실, 화장품", "sort_order": 12},
    {"name": "의료/건강", "type": "expense", "description": "병원, 약국, 건강식품", "sort_order": 11},
    {"name": "교육/자기계발", "type": "expense", "description": "학원, 수강, 도서, 운동", "sort_order": 10},
    {"name": "문화/여가", "type": "expense", "description": "영화, 공연, 취미, 여행", "sort_order": 9},
    {"name": "경조사", "type": "expense", "description": "축의금, 부의금, 선물", "sort_order": 8},
    {"name": "자녀/육아", "type": "expense", "description": "육아용품, 교육, 돌봄", "sort_order": 7},
    {"name": "반려동물", "type": "expense", "description": "사료, 병원, 용품", "sort_order": 6},
    {"name": "보험", "type": "expense", "description": "생명보험, 실손보험", "sort_order": 5},
    {"name": "대출/이자", "type": "expense", "description": "대출 상환, 이자", "sort_order": 4},
    {"name": "세금/공과금", "type": "expense", "description": "소득세, 재산세, 국민연금", "sort_order": 3},
    {"name": "구독", "type": "expense", "description": "정기결제 서비스", "sort_order": 2},
    {"name": "기타", "type": "expense", "description": "미분류 지출", "sort_order": 1},
    # 수입
    {"name": "급여", "type": "income", "description": "월급, 상여금", "sort_order": 7},
    {"name": "부수입", "type": "income", "description": "부업, 프리랜서, 아르바이트", "sort_order": 6},
    {"name": "사업소득", "type": "income", "description": "자영업, 사업 수익", "sort_order": 5},
    {"name": "투자/배당", "type": "income", "description": "이자, 배당금, 매매차익", "sort_order": 4},
    {"name": "용돈/지원", "type": "income", "description": "가족 용돈, 정부지원금", "sort_order": 3},
    {"name": "중고판매", "type": "income", "description": "중고거래, 환불", "sort_order": 2},
    {"name": "기타수입", "type": "income", "description": "미분류 수입", "sort_order": 1},
]

# 이름 변경 매핑: 기존 이름 → 새 시스템 카테고리 이름
RENAME_MAP = {
    "카페/간식": "카페/음료",
    "의료": "의료/건강",
    "교육": "교육/자기계발",
    "구독서비스": "구독",
    "이자/배당": "투자/배당",
}


def _relink_and_delete(conn, old_id: int, new_id: int) -> None:
    """기존 카테고리의 모든 FK 참조를 새 카테고리로 이전 후 삭제"""
    for table in ("expenses", "incomes", "budgets", "recurring_transactions"):
        conn.execute(
            sa.text(f"UPDATE {table} SET category_id = :new WHERE category_id = :old"),  # noqa: S608
            {"new": new_id, "old": old_id},
        )
    # category_mappings의 target_category_id도 이전
    conn.execute(
        sa.text("UPDATE category_mappings SET target_category_id = :new WHERE target_category_id = :old"),
        {"new": new_id, "old": old_id},
    )
    conn.execute(sa.text("DELETE FROM categories WHERE id = :id"), {"id": old_id})


def upgrade() -> None:
    conn = op.get_bind()

    # 1. 시스템 카테고리 25개 INSERT (중복 방지 체크 포함)
    for cat in SYSTEM_CATEGORIES:
        existing = conn.execute(
            sa.text("SELECT id FROM categories WHERE name = :name AND user_id IS NULL AND household_id IS NULL"),
            {"name": cat["name"]},
        ).fetchone()
        if existing is None:
            conn.execute(
                sa.text(
                    "INSERT INTO categories (user_id, household_id, name, type, description, sort_order) " "VALUES (NULL, NULL, :name, :type, :desc, :sort)"
                ),
                {"name": cat["name"], "type": cat["type"], "desc": cat["description"], "sort": cat["sort_order"]},
            )

    # 시스템 카테고리 ID 조회
    sys_cats = conn.execute(sa.text("SELECT id, name FROM categories WHERE user_id IS NULL AND household_id IS NULL")).fetchall()
    sys_id_by_name = {row[1]: row[0] for row in sys_cats}

    # 2. 이름 변경 대상 re-link: 기존 가구/개인 카테고리 → 새 시스템 카테고리로 FK 이전 후 삭제
    for old_name, new_name in RENAME_MAP.items():
        new_sys_id = sys_id_by_name.get(new_name)
        if new_sys_id is None:
            continue
        old_cats = conn.execute(
            sa.text("SELECT id FROM categories WHERE name = :name " "AND NOT (user_id IS NULL AND household_id IS NULL)"),
            {"name": old_name},
        ).fetchall()
        for (old_id,) in old_cats:
            _relink_and_delete(conn, old_id, new_sys_id)

    # 3. 이름 동일한 기존 가구/개인 카테고리 re-link
    for sys_name in [cat["name"] for cat in SYSTEM_CATEGORIES]:
        sys_id = sys_id_by_name.get(sys_name)
        if sys_id is None:
            continue
        dup_cats = conn.execute(
            sa.text("SELECT id FROM categories WHERE name = :name AND id != :sys_id " "AND NOT (user_id IS NULL AND household_id IS NULL)"),
            {"name": sys_name, "sys_id": sys_id},
        ).fetchall()
        for (dup_id,) in dup_cats:
            _relink_and_delete(conn, dup_id, sys_id)

    # 4. CategoryMapping seed — 이름 변경 매핑을 각 가구별로 생성
    # category_mappings.household_id는 NOT NULL이므로 가구별로 INSERT
    households = conn.execute(sa.text("SELECT id FROM households")).fetchall()
    for (hh_id,) in households:
        for old_name, new_name in RENAME_MAP.items():
            new_sys_id = sys_id_by_name.get(new_name)
            if new_sys_id is None:
                continue
            existing = conn.execute(
                sa.text("SELECT id FROM category_mappings WHERE source_name = :src AND household_id = :hh"),
                {"src": old_name, "hh": hh_id},
            ).fetchone()
            if existing is None:
                conn.execute(
                    sa.text("INSERT INTO category_mappings (household_id, user_id, source_name, target_category_id) " "VALUES (:hh, NULL, :src, :target)"),
                    {"hh": hh_id, "src": old_name, "target": new_sys_id},
                )


def downgrade() -> None:
    conn = op.get_bind()
    # 이 마이그레이션에서 seed한 시스템 카테고리만 삭제 (이름 기반 필터)
    sys_names = [cat["name"] for cat in SYSTEM_CATEGORIES]
    for name in sys_names:
        row = conn.execute(
            sa.text("SELECT id FROM categories WHERE name = :name AND user_id IS NULL AND household_id IS NULL"),
            {"name": name},
        ).fetchone()
        if row is None:
            continue
        sys_id = row[0]
        for table in ("expenses", "incomes", "budgets", "recurring_transactions"):
            conn.execute(sa.text(f"UPDATE {table} SET category_id = NULL WHERE category_id = :id"), {"id": sys_id})  # noqa: S608
        conn.execute(sa.text("UPDATE category_mappings SET target_category_id = NULL WHERE target_category_id = :id"), {"id": sys_id})
        conn.execute(sa.text("DELETE FROM categories WHERE id = :id"), {"id": sys_id})
    # CategoryMapping 삭제 (이름 변경 매핑)
    for old_name in RENAME_MAP:
        conn.execute(sa.text("DELETE FROM category_mappings WHERE source_name = :src"), {"src": old_name})
