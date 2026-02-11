---
paths:
  - "backend/**"
---

# 백엔드 규칙

## API 엔드포인트
- 라우터 prefix: /api/{리소스명}
- CRUD 순서: Create → Read(list) → Read(detail) → Update → Delete
- 응답은 Pydantic 스키마 (response_model 명시)
- 에러는 HTTPException으로 처리

## 테스트
- pytest + pytest-asyncio 사용
- 테스트 파일: tests/test_{모듈명}.py
- 비동기 테스트에 @pytest.mark.asyncio 사용
- httpx.AsyncClient로 API 테스트

## 새 기능 추가 시 순서
1. models/ 에 모델 정의 (필요시)
2. schemas/ 에 요청/응답 스키마
3. services/ 에 비즈니스 로직
4. api/ 에 라우터 추가
5. main.py에 라우터 등록
