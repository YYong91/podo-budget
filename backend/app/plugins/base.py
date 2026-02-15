"""플러그인 기본 클래스 및 훅 타입 정의

모든 플러그인은 BasePlugin을 상속받아 구현합니다.
훅(Hook)을 통해 이벤트 발생 시 플러그인이 반응할 수 있습니다.
"""

import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class HookType(str, Enum):
    """플러그인이 구독할 수 있는 이벤트 훅 타입"""

    # 지출 관련 훅
    EXPENSE_CREATED = "expense.created"
    EXPENSE_UPDATED = "expense.updated"
    EXPENSE_DELETED = "expense.deleted"

    # 예산 관련 훅
    BUDGET_EXCEEDED = "budget.exceeded"
    BUDGET_WARNING = "budget.warning"

    # 액션 훅 (사용자가 직접 실행)
    ACTION = "action"


class BasePlugin(ABC):
    """플러그인 기본 클래스

    모든 플러그인은 이 클래스를 상속받아 구현합니다.

    필수 구현:
        - id: 플러그인 고유 식별자
        - name: 표시 이름
        - description: 설명
        - version: 버전
        - category: 카테고리

    선택 구현:
        - hooks: 구독할 이벤트 훅 목록
        - config_schema: 설정 JSON Schema
        - on_event(): 이벤트 핸들러
        - execute(): 액션 실행 (ACTION 훅용)
    """

    @property
    @abstractmethod
    def id(self) -> str:
        """플러그인 고유 식별자 (예: 'csv_export')"""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """플러그인 표시 이름 (예: 'CSV 내보내기')"""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """플러그인 설명"""
        ...

    @property
    @abstractmethod
    def version(self) -> str:
        """플러그인 버전 (예: '1.0.0')"""
        ...

    @property
    @abstractmethod
    def category(self) -> str:
        """플러그인 카테고리 (export, notification, analysis)"""
        ...

    @property
    def hooks(self) -> list[HookType]:
        """구독할 이벤트 훅 목록 (기본: 빈 리스트)"""
        return []

    @property
    def config_schema(self) -> dict | None:
        """플러그인 설정 JSON Schema (기본: None)

        Returns:
            JSON Schema 딕셔너리 또는 None (설정 불필요 시)
        """
        return None

    async def on_event(self, hook: HookType, data: dict[str, Any], config: dict | None = None) -> None:
        """이벤트 훅 핸들러

        플러그인이 구독한 이벤트가 발생하면 호출됩니다.

        Args:
            hook: 발생한 이벤트 훅 타입
            data: 이벤트 데이터 (지출 정보, 예산 정보 등)
            config: 사용자별 플러그인 설정
        """
        pass

    async def execute(self, params: dict[str, Any], config: dict | None = None) -> dict[str, Any]:
        """액션 실행 (사용자가 직접 호출)

        ACTION 훅을 가진 플러그인이 구현합니다.

        Args:
            params: 실행 파라미터
            config: 사용자별 플러그인 설정

        Returns:
            실행 결과 딕셔너리 {"success": bool, "message": str, "data": ...}
        """
        return {"success": False, "message": "이 플러그인은 직접 실행을 지원하지 않습니다"}
