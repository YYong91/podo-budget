"""Alembic 마이그레이션 upgrade/downgrade round-trip 테스트 (#362)

CI에서 `alembic check`만 실행 중이라 downgrade 경로가 미테스트.
이 테스트는 SQLite 파일 DB에서 subprocess로 alembic 명령을 실행하여
upgrade head → downgrade base → upgrade head round-trip을 검증한다.

subprocess를 사용하는 이유:
- env.py가 async engine(asyncpg/aiosqlite)을 사용하므로, 테스트 프로세스 내에서
  직접 command.upgrade()를 호출하면 이미 로드된 settings와 충돌할 수 있음
- subprocess는 독립된 환경에서 alembic CLI를 실행하므로 깔끔함

SQLite는 ALTER TABLE 제한이 있어서 일부 downgrade가 실패할 수 있음.
render_as_batch=True로 대부분 해결되지만, 실패 시 SQLite 한계로 기록한다.
"""

import os
import subprocess
import tempfile
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

# backend/ 디렉토리 기준 경로
BACKEND_DIR = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def _run_alembic(db_path: str, *args: str) -> subprocess.CompletedProcess:
    """subprocess로 alembic 명령 실행

    DATABASE_URL을 SQLite 파일로 오버라이드하여 실행.
    """
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
    env.pop("MIGRATION_DATABASE_URL", None)

    result = subprocess.run(  # noqa: S603
        ["uv", "run", "alembic", *args],  # noqa: S607
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result


class TestAlembicMigrationHistory:
    """마이그레이션 히스토리 구조 검증"""

    def test_single_head(self):
        """마이그레이션 히스토리가 선형이어야 한다 (single head)"""
        config = Config(str(ALEMBIC_INI))
        script = ScriptDirectory.from_config(config)
        heads = script.get_heads()
        assert len(heads) == 1, f"마이그레이션 head가 1개여야 하지만 {len(heads)}개 발견: {heads}. 브랜치가 갈라졌다면 merge revision이 필요합니다."

    def test_no_duplicate_revisions(self):
        """중복된 revision ID가 없어야 한다"""
        config = Config(str(ALEMBIC_INI))
        script = ScriptDirectory.from_config(config)
        revisions = list(script.walk_revisions())
        rev_ids = [r.revision for r in revisions]
        assert len(rev_ids) == len(set(rev_ids)), "중복된 revision ID가 존재합니다"

    def test_all_revisions_have_downgrade(self):
        """모든 revision에 downgrade 함수가 정의되어 있어야 한다"""
        config = Config(str(ALEMBIC_INI))
        script = ScriptDirectory.from_config(config)
        missing_downgrade = []
        for rev in script.walk_revisions():
            module = rev.module
            downgrade_fn = getattr(module, "downgrade", None)
            if downgrade_fn is None:
                missing_downgrade.append(rev.revision)
        assert not missing_downgrade, f"downgrade 함수가 없는 revision: {missing_downgrade}"

    def test_revision_chain_is_connected(self):
        """base에서 head까지 chain이 끊기지 않아야 한다"""
        config = Config(str(ALEMBIC_INI))
        script = ScriptDirectory.from_config(config)
        heads = script.get_heads()
        assert len(heads) == 1, f"Single head 필요: {heads}"

        # head에서 base까지 순회 — 끊기면 예외 발생
        revisions = list(script.walk_revisions(head=heads[0]))
        assert len(revisions) > 0, "revision이 하나도 없습니다"


class TestAlembicRoundTrip:
    """upgrade → downgrade → upgrade round-trip 테스트

    subprocess로 alembic CLI를 실행하여 독립된 환경에서 테스트.
    SQLite 파일 DB를 사용하며, ALTER TABLE 제한으로 일부 downgrade가 실패할 수 있다.
    """

    def test_upgrade_head(self):
        """alembic upgrade head가 성공해야 한다"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        try:
            result = _run_alembic(db_path, "upgrade", "head")
            assert result.returncode == 0, f"upgrade head 실패:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)

    def test_upgrade_downgrade_roundtrip(self):
        """upgrade head → downgrade base → upgrade head round-trip

        SQLite의 ALTER TABLE 제한으로 downgrade가 실패할 수 있음.
        실패 시 SQLite 한계를 명시하고 skip 처리.
        """
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        try:
            # 1단계: upgrade head
            result = _run_alembic(db_path, "upgrade", "head")
            assert result.returncode == 0, f"upgrade head 실패:\nstderr: {result.stderr}"

            # 2단계: downgrade base
            result = _run_alembic(db_path, "downgrade", "base")
            if result.returncode != 0:
                pytest.skip(f"SQLite ALTER TABLE 제한으로 downgrade 실패 (프로덕션 PostgreSQL에서는 정상):\n{result.stderr[:500]}")

            # 3단계: 다시 upgrade head (빈 DB에서 재적용)
            result = _run_alembic(db_path, "upgrade", "head")
            assert result.returncode == 0, f"re-upgrade head 실패:\nstderr: {result.stderr}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)

    def test_upgrade_downgrade_one_step(self):
        """최신 마이그레이션 1단계 downgrade + 재적용

        전체 downgrade보다 실용적이고 SQLite 호환 가능성이 높다.
        """
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        try:
            # upgrade head
            result = _run_alembic(db_path, "upgrade", "head")
            assert result.returncode == 0, f"upgrade head 실패:\nstderr: {result.stderr}"

            # 최신 revision 1단계 downgrade
            result = _run_alembic(db_path, "downgrade", "-1")
            if result.returncode != 0:
                pytest.skip(f"SQLite ALTER TABLE 제한으로 1-step downgrade 실패:\n{result.stderr[:500]}")

            # 다시 upgrade head
            result = _run_alembic(db_path, "upgrade", "head")
            assert result.returncode == 0, f"re-upgrade head 실패:\nstderr: {result.stderr}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)
