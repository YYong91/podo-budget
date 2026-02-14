"""봇 메시지 템플릿 추가 단위 테스트

format_report_message, format_budget_status 함수의
다양한 케이스를 테스트합니다:
- 빈 데이터
- 단일 항목
- 여러 항목
- 예산 초과/주의/안전 상태
"""

from app.services.bot_messages import format_budget_status, format_report_message

# ===== format_report_message 테스트 =====


def test_report_message_empty():
    """지출 없을 때 리포트 메시지"""
    result = format_report_message([])
    assert "지출 리포트" in result
    assert "없어요" in result


def test_report_message_single_category():
    """단일 카테고리 리포트 메시지"""
    data = [{"category": "식비", "total": 150000, "count": 12}]
    result = format_report_message(data)

    assert "지출 리포트" in result
    assert "식비" in result
    assert "150,000원" in result
    assert "12건" in result
    assert "100.0%" in result
    assert "총 지출" in result


def test_report_message_multiple_categories():
    """여러 카테고리 리포트 메시지"""
    data = [
        {"category": "식비", "total": 200000, "count": 15},
        {"category": "교통비", "total": 100000, "count": 10},
        {"category": "문화생활", "total": 50000, "count": 3},
    ]
    result = format_report_message(data)

    assert "식비" in result
    assert "교통비" in result
    assert "문화생활" in result
    # 총 지출: 350,000원
    assert "350,000원" in result
    # 퍼센티지 확인 (식비: 200000/350000 = 57.1%)
    assert "57.1%" in result


# ===== format_budget_status 테스트 =====


def test_budget_status_empty():
    """예산 없을 때 메시지"""
    result = format_budget_status([])
    assert "예산 현황" in result
    assert "없어요" in result


def test_budget_status_safe():
    """예산 안전 상태 (80% 미만)"""
    data = [
        {
            "category": "식비",
            "budget": 300000,
            "spent": 100000,
            "remaining": 200000,
            "usage": 33.3,
        }
    ]
    result = format_budget_status(data)

    assert "예산 현황" in result
    assert "식비" in result
    assert "100,000원" in result
    assert "300,000원" in result
    assert "안전" in result
    assert "✅" in result
    assert "200,000원" in result


def test_budget_status_warning():
    """예산 주의 상태 (80% 이상 100% 미만)"""
    data = [
        {
            "category": "교통비",
            "budget": 100000,
            "spent": 85000,
            "remaining": 15000,
            "usage": 85.0,
        }
    ]
    result = format_budget_status(data)

    assert "주의" in result
    assert "⚠️" in result


def test_budget_status_exceeded():
    """예산 초과 상태 (100% 이상)"""
    data = [
        {
            "category": "카페",
            "budget": 50000,
            "spent": 65000,
            "remaining": -15000,
            "usage": 130.0,
        }
    ]
    result = format_budget_status(data)

    assert "초과" in result
    assert "🚨" in result
    assert "-15,000원" in result


def test_budget_status_multiple_items():
    """여러 예산 항목 메시지"""
    data = [
        {
            "category": "식비",
            "budget": 300000,
            "spent": 100000,
            "remaining": 200000,
            "usage": 33.3,
        },
        {
            "category": "교통비",
            "budget": 100000,
            "spent": 95000,
            "remaining": 5000,
            "usage": 95.0,
        },
        {
            "category": "카페",
            "budget": 50000,
            "spent": 60000,
            "remaining": -10000,
            "usage": 120.0,
        },
    ]
    result = format_budget_status(data)

    # 세 카테고리 모두 포함
    assert "식비" in result
    assert "교통비" in result
    assert "카페" in result
    # 다양한 상태
    assert "안전" in result
    assert "주의" in result
    assert "초과" in result
