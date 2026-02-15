"""예산 알림 플러그인

예산 초과 또는 경고 시 로그 기반 알림을 생성합니다.
향후 이메일/푸시 알림으로 확장 가능합니다.
"""

import logging
from typing import Any

from app.plugins.base import BasePlugin, HookType

logger = logging.getLogger(__name__)


class BudgetAlertPlugin(BasePlugin):
    """예산 알림 플러그인

    지출이 생성될 때 예산 상태를 확인하고,
    임계치를 초과하면 알림을 생성합니다.
    """

    @property
    def id(self) -> str:
        return "budget_alert"

    @property
    def name(self) -> str:
        return "예산 알림"

    @property
    def description(self) -> str:
        return "예산의 일정 비율을 초과하면 알림을 보냅니다. 과소비를 방지하는 데 도움이 됩니다."

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def category(self) -> str:
        return "notification"

    @property
    def hooks(self) -> list[HookType]:
        return [HookType.BUDGET_EXCEEDED, HookType.BUDGET_WARNING]

    @property
    def config_schema(self) -> dict | None:
        return {
            "type": "object",
            "properties": {
                "warning_threshold": {
                    "type": "number",
                    "title": "경고 임계치 (%)",
                    "description": "이 비율을 초과하면 경고 알림을 보냅니다",
                    "default": 80,
                    "minimum": 50,
                    "maximum": 100,
                },
                "notify_on_exceed": {
                    "type": "boolean",
                    "title": "초과 시 알림",
                    "description": "예산을 초과했을 때 알림을 보냅니다",
                    "default": True,
                },
            },
        }

    async def on_event(self, hook: HookType, data: dict[str, Any], config: dict | None = None) -> None:
        """예산 관련 이벤트 처리

        Args:
            hook: BUDGET_EXCEEDED 또는 BUDGET_WARNING
            data: {"budget_id", "category_name", "budget_amount", "spent_amount", "usage_percentage"}
            config: {"warning_threshold", "notify_on_exceed"}
        """
        config = config or {}
        category = data.get("category_name", "미분류")
        usage = data.get("usage_percentage", 0)
        budget_amount = data.get("budget_amount", 0)
        spent_amount = data.get("spent_amount", 0)

        if hook == HookType.BUDGET_EXCEEDED:
            if config.get("notify_on_exceed", True):
                logger.warning(
                    f"[예산 알림] {category} 예산 초과! "
                    f"예산: {budget_amount:,.0f}원, 사용: {spent_amount:,.0f}원 ({usage:.1f}%)"
                )
        elif hook == HookType.BUDGET_WARNING:
            threshold = config.get("warning_threshold", 80)
            if usage >= threshold:
                logger.info(
                    f"[예산 알림] {category} 예산 경고 ({usage:.1f}% 사용) "
                    f"예산: {budget_amount:,.0f}원, 사용: {spent_amount:,.0f}원"
                )
