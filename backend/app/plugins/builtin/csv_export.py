"""CSV 내보내기 플러그인

지출 데이터를 CSV 형식으로 내보내는 기능을 제공합니다.
"""

import csv
import io
import logging
from typing import Any

from app.plugins.base import BasePlugin, HookType

logger = logging.getLogger(__name__)


class CsvExportPlugin(BasePlugin):
    """CSV 내보내기 플러그인

    사용자의 지출 데이터를 CSV 형식으로 변환하여 반환합니다.
    ACTION 훅을 통해 사용자가 직접 실행합니다.
    """

    @property
    def id(self) -> str:
        return "csv_export"

    @property
    def name(self) -> str:
        return "CSV 내보내기"

    @property
    def description(self) -> str:
        return "지출 데이터를 CSV 파일 형식으로 내보냅니다. 엑셀 등에서 열 수 있습니다."

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def category(self) -> str:
        return "export"

    @property
    def hooks(self) -> list[HookType]:
        return [HookType.ACTION]

    @property
    def config_schema(self) -> dict | None:
        return {
            "type": "object",
            "properties": {
                "include_raw_input": {
                    "type": "boolean",
                    "title": "원본 입력 포함",
                    "description": "자연어 원본 입력을 CSV에 포함합니다",
                    "default": False,
                },
                "encoding": {
                    "type": "string",
                    "title": "인코딩",
                    "description": "CSV 파일 인코딩",
                    "enum": ["utf-8", "euc-kr"],
                    "default": "utf-8",
                },
            },
        }

    async def execute(self, params: dict[str, Any], config: dict | None = None) -> dict[str, Any]:
        """지출 데이터를 CSV 문자열로 변환

        params에 expenses 리스트가 필요합니다.

        Args:
            params: {"expenses": [...]} 형태의 지출 데이터
            config: 사용자 설정 (include_raw_input, encoding)

        Returns:
            {"success": True, "data": {"csv": "...", "filename": "..."}}
        """
        expenses = params.get("expenses", [])
        if not expenses:
            return {"success": False, "message": "내보낼 지출 데이터가 없습니다"}

        config = config or {}
        include_raw = config.get("include_raw_input", False)

        output = io.StringIO()
        headers = ["날짜", "설명", "금액", "카테고리"]
        if include_raw:
            headers.append("원본 입력")

        writer = csv.writer(output)
        writer.writerow(headers)

        for exp in expenses:
            row = [
                exp.get("date", ""),
                exp.get("description", ""),
                exp.get("amount", 0),
                exp.get("category_name", "미분류"),
            ]
            if include_raw:
                row.append(exp.get("raw_input", ""))
            writer.writerow(row)

        csv_content = output.getvalue()
        output.close()

        return {
            "success": True,
            "message": f"{len(expenses)}건의 지출 데이터를 CSV로 변환했습니다",
            "data": {
                "csv": csv_content,
                "filename": "homenrich_expenses.csv",
                "count": len(expenses),
            },
        }
