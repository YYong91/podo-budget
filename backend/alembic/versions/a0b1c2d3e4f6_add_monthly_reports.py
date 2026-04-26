"""월간 결산 리포트 테이블 추가

가구별 월간 결산 리포트를 저장하는 monthly_reports 테이블을 추가합니다.
매월 자동 생성되며, 가구당 월 1개의 리포트만 허용됩니다 (unique constraint).

Revision ID: a0b1c2d3e4f6
Revises: z9a0b1c2d3e4
Create Date: 2026-04-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a0b1c2d3e4f6"  # pragma: allowlist secret
down_revision: str | None = "z9a0b1c2d3e4"  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "monthly_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        # ── 식별 ──
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column(
            "month",
            sa.String(7),
            nullable=False,
            comment="YYYY-MM 형식 (예: 2026-04)",
        ),
        # ── 상태 머신 ──
        sa.Column(
            "status",
            sa.String(15),
            nullable=False,
            server_default="pending",
            comment="pending | processing | completed | failed",
        ),
        sa.Column(
            "attempt_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="LLM 호출 시도 횟수. 0=Phase 1 완료, 1+=Phase 2 시도",
        ),
        sa.Column(
            "last_error",
            sa.String(2000),
            nullable=True,
            comment="마지막 실패 사유 (2000자 truncate)",
        ),
        sa.Column(
            "trigger_source",
            sa.String(15),
            nullable=False,
            server_default="auto",
            comment="auto | admin | retry",
        ),
        # ── 데이터 스냅샷 ──
        sa.Column(
            "report_data",
            sa.JSON(),
            nullable=False,
            comment="분석 시점의 입력 스냅샷. 이후 거래 변경과 무관하게 불변.",
        ),
        sa.Column(
            "insights",
            sa.JSON(),
            nullable=True,
            comment="LLM 출력 (StructuredInsightsResponse 구조). completed 시에만 채워짐.",
        ),
        sa.Column(
            "insights_version",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="LLM 출력 스키마 버전. 스키마 변경 시 증가하여 하위 호환 처리 기준으로 사용.",
        ),
        # ── 메타 ──
        sa.Column("llm_tokens_used", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        # ── 제약조건 ──
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "household_id",
            "month",
            name="uq_monthly_report_household_month",
        ),
    )
    # 월별 + 상태별 조회를 위한 복합 인덱스
    op.create_index(
        "ix_monthly_reports_month_status",
        "monthly_reports",
        ["month", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_monthly_reports_month_status", table_name="monthly_reports")
    op.drop_table("monthly_reports")
