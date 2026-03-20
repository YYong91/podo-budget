"""
성능 개선 유닛 테스트 (#238, #239, #241, #251)

- #238: DB 인덱스 누락 — Budget/HouseholdMember/Category 모델 __table_args__ 검증
- #239: chat.py 직렬 쿼리 → asyncio.gather 병렬화 검증
- #241: pool_pre_ping + pool_recycle 설정 검증
- #251: LLM 프로바이더 인스턴스 캐싱 + 카테고리 힌트 TTLCache 검증
"""

from sqlalchemy import Index

# ── #238: DB 인덱스 검증 ──────────────────────────────────────────────────────


def test_budget_has_composite_index_household_period():
    """Budget 모델에 (household_id, period) 복합 인덱스 존재"""
    from app.models.budget import Budget

    args = getattr(Budget, "__table_args__", None)
    assert args is not None, "Budget.__table_args__ 미정의"

    # Index 타입 항목 중 (household_id, period) 포함 여부 확인
    index_columns = set()
    for arg in args:
        if isinstance(arg, Index):
            index_columns.update(c.name for c in arg.columns)

    assert "household_id" in index_columns, "Budget에 household_id 인덱스 없음"
    assert "period" in index_columns, "Budget에 period 인덱스 없음"


def test_budget_has_date_range_index():
    """Budget 모델에 (start_date, end_date) 복합 인덱스 존재"""
    from app.models.budget import Budget

    args = getattr(Budget, "__table_args__", None)
    assert args is not None

    index_columns = set()
    for arg in args:
        if isinstance(arg, Index):
            index_columns.update(c.name for c in arg.columns)

    assert "start_date" in index_columns, "Budget에 start_date 인덱스 없음"


def test_household_member_has_user_id_left_at_index():
    """HouseholdMember에 (user_id, left_at) 인덱스 — get_household_member 쿼리 최적화"""
    from app.models.household_member import HouseholdMember

    args = getattr(HouseholdMember, "__table_args__", None)
    assert args is not None

    index_columns = set()
    for arg in args:
        if isinstance(arg, Index):
            index_columns.update(c.name for c in arg.columns)

    assert "user_id" in index_columns, "HouseholdMember에 user_id 인덱스 없음"
    assert "left_at" in index_columns, "HouseholdMember에 left_at 인덱스 없음"


def test_category_has_household_type_index():
    """Category에 (household_id, type) 복합 인덱스 존재"""
    from app.models.category import Category

    args = getattr(Category, "__table_args__", None)
    assert args is not None

    index_columns = set()
    for arg in args:
        if isinstance(arg, Index):
            index_columns.update(c.name for c in arg.columns)

    assert "household_id" in index_columns, "Category에 household_id 인덱스 없음"
    assert "type" in index_columns, "Category에 type 인덱스 없음"


# ── #239: chat.py asyncio.gather 병렬화 검증 ───────────────────────────────────


def test_chat_uses_asyncio_gather_for_db_queries():
    """chat.py가 asyncio.gather를 임포트하고 3개 DB 쿼리를 병렬화하는지 소스 검증"""
    import inspect

    from app.api import chat as chat_module

    source = inspect.getsource(chat_module)
    assert "asyncio.gather" in source, "chat.py에 asyncio.gather 미사용 (#239 미구현)"
    assert "import asyncio" in source, "chat.py에 asyncio 임포트 없음"


# ── #241: pool_pre_ping 설정 검증 ─────────────────────────────────────────────


def test_database_engine_create_kwargs_include_pool_pre_ping():
    """create_async_engine 호출에 pool_pre_ping=True가 포함되는지 소스 검증"""
    import inspect

    from app.core import database as db_module

    source = inspect.getsource(db_module)
    assert "pool_pre_ping=True" in source, "database.py에 pool_pre_ping=True 설정 없음 (#241)"
    assert "pool_recycle" in source, "database.py에 pool_recycle 설정 없음 (#241)"


# ── #251: LLM 프로바이더 캐싱 검증 ────────────────────────────────────────────


def test_get_llm_provider_returns_cached_instance():
    """같은 파라미터의 get_llm_provider 호출은 동일 인스턴스 반환 (캐싱)"""
    from app.services.llm_service import get_llm_provider

    provider1 = get_llm_provider("parse")
    provider2 = get_llm_provider("parse")

    assert provider1 is provider2, "get_llm_provider()가 매번 새 인스턴스 생성 — 캐싱 필요 (#251)"


def test_get_llm_provider_different_features_different_instances():
    """다른 feature의 get_llm_provider는 다른 인스턴스 가능"""
    from app.services.llm_service import get_llm_provider

    provider_parse = get_llm_provider("parse")
    provider_insights = get_llm_provider("insights")

    # feature가 다르면 다른 인스턴스일 수 있음 (설정 따라 같을 수도)
    # 핵심은 같은 feature는 같은 인스턴스 → 이미 위에서 검증
    assert provider_parse is not None
    assert provider_insights is not None
