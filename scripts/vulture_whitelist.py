"""Vulture whitelist — 오탐 방지

FastAPI 라우트 핸들러, Pydantic 모델 필드 등 vulture가 "unused"로 오탐하는 패턴을 등록.
vulture 실행 시 이 파일을 함께 지정: vulture backend/app/ scripts/vulture_whitelist.py
"""

# FastAPI 라우트 핸들러는 데코레이터로 등록되므로 직접 호출되지 않음
# vulture가 "unused function"으로 오탐하는 것을 방지
_.get  # type: ignore
_.post  # type: ignore
_.put  # type: ignore
_.patch  # type: ignore
_.delete  # type: ignore

# Pydantic model_config는 클래스 변수로 사용됨
_.model_config  # type: ignore
_.from_attributes  # type: ignore

# SQLAlchemy 이벤트 리스너 콜백 파라미터
_.connection_record  # type: ignore

# Pydantic field_validator
_.validate_frequency_fields  # type: ignore
_.coerce_date_to_datetime  # type: ignore
