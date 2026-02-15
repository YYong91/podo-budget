"""플러그인 매니저

플러그인 등록, 활성화/비활성화, 이벤트 디스패치를 담당합니다.
"""

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plugin import PluginState
from app.plugins.base import BasePlugin, HookType

logger = logging.getLogger(__name__)


class PluginManager:
    """플러그인 관리자

    싱글턴으로 사용되며, 등록된 플러그인을 관리하고 이벤트를 디스패치합니다.
    """

    def __init__(self) -> None:
        self._plugins: dict[str, BasePlugin] = {}

    def register(self, plugin: BasePlugin) -> None:
        """플러그인 등록

        Args:
            plugin: 등록할 플러그인 인스턴스

        Raises:
            ValueError: 이미 등록된 플러그인 ID인 경우
        """
        if plugin.id in self._plugins:
            raise ValueError(f"플러그인 '{plugin.id}'이(가) 이미 등록되어 있습니다")
        self._plugins[plugin.id] = plugin
        logger.info(f"플러그인 등록: {plugin.id} ({plugin.name} v{plugin.version})")

    def unregister(self, plugin_id: str) -> None:
        """플러그인 등록 해제

        Args:
            plugin_id: 해제할 플러그인 ID
        """
        if plugin_id in self._plugins:
            del self._plugins[plugin_id]
            logger.info(f"플러그인 등록 해제: {plugin_id}")

    def get_plugin(self, plugin_id: str) -> BasePlugin | None:
        """플러그인 조회

        Args:
            plugin_id: 조회할 플러그인 ID

        Returns:
            플러그인 인스턴스 또는 None
        """
        return self._plugins.get(plugin_id)

    def get_all_plugins(self) -> list[BasePlugin]:
        """등록된 모든 플러그인 반환"""
        return list(self._plugins.values())

    async def get_user_plugin_state(
        self,
        user_id: int,
        plugin_id: str,
        db: AsyncSession,
    ) -> PluginState | None:
        """사용자별 플러그인 상태 조회

        Args:
            user_id: 사용자 ID
            plugin_id: 플러그인 ID
            db: DB 세션

        Returns:
            PluginState 또는 None
        """
        result = await db.execute(
            select(PluginState).where(
                PluginState.user_id == user_id,
                PluginState.plugin_id == plugin_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_user_all_states(
        self,
        user_id: int,
        db: AsyncSession,
    ) -> dict[str, PluginState]:
        """사용자의 모든 플러그인 상태 조회

        Args:
            user_id: 사용자 ID
            db: DB 세션

        Returns:
            {plugin_id: PluginState} 딕셔너리
        """
        result = await db.execute(
            select(PluginState).where(PluginState.user_id == user_id)
        )
        states = result.scalars().all()
        return {s.plugin_id: s for s in states}

    async def set_enabled(
        self,
        user_id: int,
        plugin_id: str,
        enabled: bool,
        db: AsyncSession,
    ) -> PluginState:
        """플러그인 활성화/비활성화

        Args:
            user_id: 사용자 ID
            plugin_id: 플러그인 ID
            enabled: 활성화 여부
            db: DB 세션

        Returns:
            업데이트된 PluginState

        Raises:
            ValueError: 존재하지 않는 플러그인 ID인 경우
        """
        if plugin_id not in self._plugins:
            raise ValueError(f"존재하지 않는 플러그인: {plugin_id}")

        state = await self.get_user_plugin_state(user_id, plugin_id, db)
        if state is None:
            state = PluginState(user_id=user_id, plugin_id=plugin_id, enabled=enabled)
            db.add(state)
        else:
            state.enabled = enabled

        await db.commit()
        await db.refresh(state)
        return state

    async def update_config(
        self,
        user_id: int,
        plugin_id: str,
        config: dict,
        db: AsyncSession,
    ) -> PluginState:
        """플러그인 설정 업데이트

        Args:
            user_id: 사용자 ID
            plugin_id: 플러그인 ID
            config: 새로운 설정 딕셔너리
            db: DB 세션

        Returns:
            업데이트된 PluginState

        Raises:
            ValueError: 존재하지 않는 플러그인 ID인 경우
        """
        if plugin_id not in self._plugins:
            raise ValueError(f"존재하지 않는 플러그인: {plugin_id}")

        state = await self.get_user_plugin_state(user_id, plugin_id, db)
        if state is None:
            state = PluginState(
                user_id=user_id,
                plugin_id=plugin_id,
                enabled=False,
                config_json=json.dumps(config, ensure_ascii=False),
            )
            db.add(state)
        else:
            state.config_json = json.dumps(config, ensure_ascii=False)

        await db.commit()
        await db.refresh(state)
        return state

    async def dispatch(
        self,
        hook: HookType,
        user_id: int,
        data: dict[str, Any],
        db: AsyncSession,
    ) -> None:
        """이벤트 디스패치 — 해당 훅을 구독하는 활성 플러그인에 이벤트 전달

        Args:
            hook: 이벤트 훅 타입
            user_id: 이벤트 발생 사용자 ID
            data: 이벤트 데이터
            db: DB 세션
        """
        user_states = await self.get_user_all_states(user_id, db)

        for plugin in self._plugins.values():
            if hook not in plugin.hooks:
                continue

            state = user_states.get(plugin.id)
            if state is None or not state.enabled:
                continue

            # 플러그인 설정 파싱
            config = None
            if state.config_json:
                try:
                    config = json.loads(state.config_json)
                except json.JSONDecodeError:
                    logger.warning(f"플러그인 설정 파싱 실패: {plugin.id}")

            try:
                await plugin.on_event(hook, data, config)
            except Exception:
                logger.exception(f"플러그인 이벤트 처리 실패: {plugin.id}")

    async def execute_plugin(
        self,
        plugin_id: str,
        user_id: int,
        params: dict[str, Any],
        db: AsyncSession,
    ) -> dict[str, Any]:
        """플러그인 액션 실행

        Args:
            plugin_id: 실행할 플러그인 ID
            user_id: 실행 사용자 ID
            params: 실행 파라미터
            db: DB 세션

        Returns:
            실행 결과 딕셔너리

        Raises:
            ValueError: 존재하지 않는 플러그인 ID인 경우
        """
        plugin = self._plugins.get(plugin_id)
        if plugin is None:
            raise ValueError(f"존재하지 않는 플러그인: {plugin_id}")

        if HookType.ACTION not in plugin.hooks:
            return {"success": False, "message": "이 플러그인은 직접 실행을 지원하지 않습니다"}

        # 사용자 설정 조회
        state = await self.get_user_plugin_state(user_id, plugin_id, db)
        config = None
        if state and state.config_json:
            try:
                config = json.loads(state.config_json)
            except json.JSONDecodeError:
                pass

        return await plugin.execute(params, config)


# 싱글턴 인스턴스
plugin_manager = PluginManager()
