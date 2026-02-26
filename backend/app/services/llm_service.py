"""LLM 프로바이더 추상화 및 구현 모듈

기능별로 다른 프로바이더/모델을 사용할 수 있도록 설계되어 있습니다.
- get_llm_provider("parse")  → 지출 파싱용 프로바이더
- get_llm_provider("insights") → 인사이트 생성용 프로바이더
- get_llm_provider("ocr")    → OCR용 프로바이더
- get_llm_provider()         → 기본 프로바이더

.env 예시:
    LLM_PROVIDER=anthropic              # 기본 프로바이더
    LLM_PROVIDER_PARSE=openai           # 파싱은 OpenAI로 오버라이드
    LLM_MODEL_PARSE=gpt-4.1-mini        # 파싱 모델 지정
"""

import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Literal

from app.core.config import settings

logger = logging.getLogger(__name__)

# 기능 타입 정의
LLMFeature = Literal["parse", "insights", "ocr"]

# 프로바이더별 기본 모델
DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-haiku-4-5-20251001",
    "openai": "gpt-4o-mini",
    "google": "gemini-2.0-flash",
    "local": "llama3",
}


class LLMProvider(ABC):
    @abstractmethod
    async def parse_expense(self, user_input: str) -> dict[str, Any] | list[dict[str, Any]]:
        """사용자 입력을 파싱하여 지출 정보 추출

        Returns:
            단일 지출: dict (에러 포함 가능)
            여러 지출: list[dict] (각 항목은 지출 정보)
        """
        pass

    @abstractmethod
    async def parse_image(self, image_bytes: bytes, media_type: str) -> dict[str, Any] | list[dict[str, Any]]:
        """이미지에서 지출 정보 추출 (OCR)

        Returns:
            단일 지출: dict (에러 포함 가능)
            여러 지출: list[dict]
        """
        pass

    @abstractmethod
    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        """지출 데이터를 분석하여 인사이트 생성"""
        pass


class AnthropicProvider(LLMProvider):
    def __init__(self, model: str = ""):
        import anthropic

        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = model or DEFAULT_MODELS["anthropic"]

    async def parse_expense(self, user_input: str) -> dict[str, Any] | list[dict[str, Any]]:
        """Claude API로 자연어 지출 입력을 구조화된 데이터로 변환

        단일 지출 또는 여러 지출을 파싱합니다.
        여러 지출인 경우 리스트로 반환합니다.
        """
        from app.services.prompts import get_expense_parser_prompt

        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=2048,  # 다수 항목(15+) 파싱 시 JSON 중간 절단 방지
                    system=get_expense_parser_prompt(),
                    messages=[{"role": "user", "content": user_input}],
                )

                # 토큰 한도 초과 감지 — JSON이 중간에 잘린 경우
                if response.stop_reason == "max_tokens":
                    logger.warning(f"max_tokens 초과: 응답이 잘렸습니다. 입력 길이={len(user_input)}")
                    return {"error": "입력이 너무 길어 처리할 수 없습니다. 날짜별로 나누어 입력해주세요."}

                # 텍스트 응답에서 JSON 추출
                text = response.content[0].text.strip()

                # ```json ... ``` 블록이 있으면 내부만 추출
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()

                parsed = json.loads(text)

                # 단일 지출 (dict)인 경우
                if isinstance(parsed, dict):
                    # 에러 응답 확인
                    if "error" in parsed:
                        return parsed

                    # 필수 필드 검증
                    if "amount" not in parsed or parsed["amount"] is None:
                        return {"error": "금액을 찾을 수 없습니다"}

                    return parsed

                # 여러 지출 (list)인 경우
                elif isinstance(parsed, list):
                    # 각 항목의 필수 필드 검증
                    for item in parsed:
                        if not isinstance(item, dict):
                            return {"error": "잘못된 형식입니다"}
                        if "amount" not in item or item["amount"] is None:
                            return {"error": "일부 항목의 금액을 찾을 수 없습니다"}

                    return parsed

                else:
                    return {"error": "잘못된 형식입니다"}

            except json.JSONDecodeError:
                logger.warning(f"JSON 파싱 실패 (시도 {attempt + 1}/{max_retries}): {text}")
                if attempt == max_retries - 1:
                    return {"error": "응답을 파싱할 수 없습니다"}
            except Exception as e:
                logger.error(f"Claude API 호출 실패: {e}")
                if attempt == max_retries - 1:
                    return {"error": f"LLM 서비스 오류: {str(e)}"}

        return {"error": "알 수 없는 오류가 발생했습니다"}

    async def parse_image(self, image_bytes: bytes, media_type: str) -> dict[str, Any] | list[dict[str, Any]]:
        """Claude Vision으로 결제 스크린샷/영수증 이미지를 파싱"""
        import base64

        from app.services.prompts import get_ocr_expense_prompt

        image_data = base64.b64encode(image_bytes).decode("utf-8")

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=512,
                system=get_ocr_expense_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_data,
                                },
                            },
                            {
                                "type": "text",
                                "text": "이 이미지에서 결제 정보를 추출해주세요.",
                            },
                        ],
                    }
                ],
            )

            text = response.content[0].text.strip()

            # ```json ... ``` 블록이 있으면 내부만 추출
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(text)

            if isinstance(parsed, dict):
                if "error" in parsed:
                    return parsed
                if "amount" not in parsed or parsed["amount"] is None:
                    return {"error": "금액을 찾을 수 없습니다"}
                return parsed

            elif isinstance(parsed, list):
                for item in parsed:
                    if not isinstance(item, dict) or "amount" not in item:
                        return {"error": "잘못된 형식입니다"}
                return parsed

            else:
                return {"error": "잘못된 형식입니다"}

        except json.JSONDecodeError:
            logger.warning(f"OCR JSON 파싱 실패: {text}")
            return {"error": "응답을 파싱할 수 없습니다"}
        except Exception as e:
            logger.error(f"Claude Vision OCR 실패: {e}")
            return {"error": f"이미지 인식 오류: {str(e)}"}

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
    def __init__(self, model: str = ""):
        import openai

        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = model or DEFAULT_MODELS["openai"]

    async def parse_expense(self, user_input: str) -> dict[str, Any] | list[dict[str, Any]]:
        """OpenAI API로 자연어 지출 입력을 구조화된 데이터로 변환

        단일 지출 또는 여러 지출을 파싱합니다.
        여러 지출인 경우 리스트로 반환합니다.
        """
        from app.services.prompts import get_expense_parser_prompt

        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    max_tokens=2048,  # 다수 항목(15+) 파싱 시 JSON 중간 절단 방지
                    messages=[
                        {"role": "system", "content": get_expense_parser_prompt()},
                        {"role": "user", "content": user_input},
                    ],
                )

                # 토큰 한도 초과 감지
                if response.choices[0].finish_reason == "length":
                    logger.warning(f"max_tokens 초과: 응답이 잘렸습니다. 입력 길이={len(user_input)}")
                    return {"error": "입력이 너무 길어 처리할 수 없습니다. 날짜별로 나누어 입력해주세요."}

                # 텍스트 응답에서 JSON 추출
                text = response.choices[0].message.content.strip()

                # ```json ... ``` 블록이 있으면 내부만 추출
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()

                parsed = json.loads(text)

                # 단일 지출 (dict)인 경우
                if isinstance(parsed, dict):
                    # 에러 응답 확인
                    if "error" in parsed:
                        return parsed

                    # 필수 필드 검증
                    if "amount" not in parsed or parsed["amount"] is None:
                        return {"error": "금액을 찾을 수 없습니다"}

                    return parsed

                # 여러 지출 (list)인 경우
                elif isinstance(parsed, list):
                    # 각 항목의 필수 필드 검증
                    for item in parsed:
                        if not isinstance(item, dict):
                            return {"error": "잘못된 형식입니다"}
                        if "amount" not in item or item["amount"] is None:
                            return {"error": "일부 항목의 금액을 찾을 수 없습니다"}

                    return parsed

                else:
                    return {"error": "잘못된 형식입니다"}

            except json.JSONDecodeError:
                logger.warning(f"JSON 파싱 실패 (시도 {attempt + 1}/{max_retries}): {text}")
                if attempt == max_retries - 1:
                    return {"error": "응답을 파싱할 수 없습니다"}
            except Exception as e:
                logger.error(f"OpenAI API 호출 실패: {e}")
                if attempt == max_retries - 1:
                    return {"error": f"LLM 서비스 오류: {str(e)}"}

        return {"error": "알 수 없는 오류가 발생했습니다"}

    async def parse_image(self, image_bytes: bytes, media_type: str) -> dict[str, Any] | list[dict[str, Any]]:
        raise NotImplementedError("OpenAI 프로바이더는 이미지 OCR을 지원하지 않습니다")

    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        """지출 데이터를 분석하여 인사이트 Markdown 텍스트 생성"""
        from app.services.prompts import INSIGHTS_SYSTEM_PROMPT

        try:
            # 지출 데이터를 텍스트로 정리
            data_text = json.dumps(expenses_data, ensure_ascii=False, indent=2)

            response = await self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": INSIGHTS_SYSTEM_PROMPT},
                    {"role": "user", "content": f"다음 지출 데이터를 분석해주세요:\n\n{data_text}"},
                ],
            )

            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"인사이트 생성 실패: {e}")
            return f"인사이트 생성 중 오류가 발생했습니다: {str(e)}"


class GoogleProvider(LLMProvider):
    def __init__(self, model: str = ""):
        self.model = model or DEFAULT_MODELS["google"]
        self.api_key = settings.GOOGLE_API_KEY

    async def parse_expense(self, user_input: str) -> dict[str, Any] | list[dict[str, Any]]:
        raise NotImplementedError("Google Gemini 프로바이더는 아직 구현되지 않았습니다")

    async def parse_image(self, image_bytes: bytes, media_type: str) -> dict[str, Any] | list[dict[str, Any]]:
        raise NotImplementedError("Google Gemini 프로바이더는 이미지 OCR을 지원하지 않습니다")

    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        raise NotImplementedError("Google Gemini 프로바이더는 아직 구현되지 않았습니다")


class LocalLLMProvider(LLMProvider):
    def __init__(self, model: str = ""):
        self.model = model or DEFAULT_MODELS["local"]

    async def parse_expense(self, user_input: str) -> dict[str, Any] | list[dict[str, Any]]:
        raise NotImplementedError("로컬 LLM 프로바이더는 아직 구현되지 않았습니다")

    async def parse_image(self, image_bytes: bytes, media_type: str) -> dict[str, Any] | list[dict[str, Any]]:
        raise NotImplementedError("로컬 LLM 프로바이더는 이미지 OCR을 지원하지 않습니다")

    async def generate_insights(self, expenses_data: dict[str, Any]) -> str:
        raise NotImplementedError("로컬 LLM 프로바이더는 아직 구현되지 않았습니다")


def _resolve_provider_and_model(feature: LLMFeature | None = None) -> tuple[str, str]:
    """기능에 맞는 프로바이더와 모델을 결정

    기능별 오버라이드가 있으면 사용, 없으면 기본값으로 fallback.
    """
    provider = settings.LLM_PROVIDER
    model = settings.LLM_MODEL

    if feature:
        feature_provider = getattr(settings, f"LLM_PROVIDER_{feature.upper()}", None)
        feature_model = getattr(settings, f"LLM_MODEL_{feature.upper()}", "")
        if feature_provider:
            provider = feature_provider
        if feature_model:
            model = feature_model

    return provider, model


def _create_provider(provider_name: str, model: str) -> LLMProvider:
    """프로바이더 인스턴스 생성"""
    providers = {
        "anthropic": AnthropicProvider,
        "openai": OpenAIProvider,
        "google": GoogleProvider,
        "local": LocalLLMProvider,
    }
    cls = providers.get(provider_name)
    if not cls:
        raise ValueError(f"Unknown LLM provider: {provider_name}")
    return cls(model=model)


def get_llm_provider(feature: LLMFeature | None = None) -> LLMProvider:
    """설정된 LLM provider 반환

    Args:
        feature: 기능 이름 ("parse", "insights", "ocr").
                 None이면 기본 프로바이더를 반환합니다.

    사용 예:
        get_llm_provider()            # 기본 프로바이더
        get_llm_provider("parse")     # 지출 파싱용 (오버라이드 가능)
        get_llm_provider("insights")  # 인사이트용 (오버라이드 가능)
    """
    provider_name, model = _resolve_provider_and_model(feature)
    return _create_provider(provider_name, model)
