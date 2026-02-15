"""HomeNRich 플러그인 시스템

이벤트 기반 플러그인 아키텍처로 기능을 확장할 수 있습니다.
- BasePlugin: 모든 플러그인의 기본 클래스
- PluginManager: 플러그인 등록, 활성화, 이벤트 디스패치
- 내장 플러그인: CSV 내보내기, 예산 알림, 지출 요약
"""

from app.plugins.base import BasePlugin, HookType
from app.plugins.manager import plugin_manager

__all__ = ["BasePlugin", "HookType", "plugin_manager"]
