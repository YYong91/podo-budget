"""LLM 프로바이더 추상화 및 구현 모듈"""

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    @abstractmethod
    async def parse_expense(self, user_input: str) -> dict[str, Any]:
        """사용자 입력을 파싱하여 지출 정보 추출"""
        pass

    @abstractmethod
    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        """지출 데이터를 분석하여 인사이트 생성"""
        pass


class AnthropicProvider(LLMProvider):
    def __init__(self):
        import anthropic

        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-sonnet-4-5-20250929"

    async def parse_expense(self, user_input: str) -> dict[str, Any]:
        """Claude API로 자연어 지출 입력을 구조화된 데이터로 변환"""
        from app.services.prompts import get_expense_parser_prompt

        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=256,
                    system=get_expense_parser_prompt(),
                    messages=[{"role": "user", "content": user_input}],
                )

                # 텍스트 응답에서 JSON 추출
                text = response.content[0].text.strip()

                # ```json ... ``` 블록이 있으면 내부만 추출
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()

                parsed = json.loads(text)

                # 에러 응답 확인
                if "error" in parsed:
                    return parsed

                # 필수 필드 검증
                if "amount" not in parsed or parsed["amount"] is None:
                    return {"error": "금액을 찾을 수 없습니다"}

                return parsed

            except json.JSONDecodeError:
                logger.warning(f"JSON 파싱 실패 (시도 {attempt + 1}/{max_retries}): {text}")
                if attempt == max_retries - 1:
                    return {"error": "응답을 파싱할 수 없습니다"}
            except Exception as e:
                logger.error(f"Claude API 호출 실패: {e}")
                if attempt == max_retries - 1:
                    return {"error": f"LLM 서비스 오류: {str(e)}"}

        return {"error": "알 수 없는 오류가 발생했습니다"}

    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        """지출 데이터를 분석하여 인사이트 Markdown 텍스트 생성"""
        from app.services.prompts import INSIGHTS_SYSTEM_PROMPT

        try:
            # 지출 데이터를 텍스트로 정리
            data_text = json.dumps(expenses_data, ensure_ascii=False, indent=2)

            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=INSIGHTS_SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": f"다음 지출 데이터를 분석해주세요:\n\n{data_text}",
                    }
                ],
            )

            return response.content[0].text

        except Exception as e:
            logger.error(f"인사이트 생성 실패: {e}")
            return f"인사이트 생성 중 오류가 발생했습니다: {str(e)}"


class OpenAIProvider(LLMProvider):
    def __init__(self):
        import openai

        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def parse_expense(self, user_input: str) -> dict[str, Any]:
        # TODO: OpenAI 구현
        return {"error": "OpenAI 프로바이더는 아직 구현되지 않았습니다"}

    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        return "OpenAI 프로바이더는 아직 구현되지 않았습니다"


class LocalLLMProvider(LLMProvider):
    async def parse_expense(self, user_input: str) -> dict[str, Any]:
        # TODO: 로컬 LLM 구현
        return {"error": "로컬 LLM 프로바이더는 아직 구현되지 않았습니다"}

    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        return "로컬 LLM 프로바이더는 아직 구현되지 않았습니다"


def get_llm_provider() -> LLMProvider:
    """설정된 LLM provider 반환"""
    if settings.LLM_PROVIDER == "openai":
        return OpenAIProvider()
    elif settings.LLM_PROVIDER == "anthropic":
        return AnthropicProvider()
    elif settings.LLM_PROVIDER == "local":
        return LocalLLMProvider()
    else:
        raise ValueError(f"Unknown LLM provider: {settings.LLM_PROVIDER}")
