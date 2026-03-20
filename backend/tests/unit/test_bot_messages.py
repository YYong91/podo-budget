"""
봇 메시지 템플릿 단위 테스트 — UX 리디자인 버전

모든 format 함수의 출력 형식, 길이 제한, 한글 메시지 검증
"""

from datetime import date, datetime, timedelta

from app.services.bot_messages import (
    format_budget_status,
    format_delete_confirm,
    format_expense_saved,
    format_help_message,
    format_income_saved,
    format_korean_date,
    format_mixed_saved,
    format_parse_error,
    format_report_message,
    format_server_error,
    format_timeout_message,
    format_unknown_input,
    format_welcome_message,
)

# ===== format_korean_date =====


class TestFormatKoreanDate:
    """한국어 날짜 포맷 함수"""

    def test_today_returns_오늘(self):
        """오늘 날짜 → '오늘'"""
        today = date.today()
        assert format_korean_date(today) == "오늘"

    def test_today_datetime(self):
        """datetime 타입도 지원"""
        now = datetime.now()
        assert format_korean_date(now) == "오늘"

    def test_yesterday_returns_어제(self):
        """어제 날짜 → '어제'"""
        yesterday = date.today() - timedelta(days=1)
        assert format_korean_date(yesterday) == "어제"

    def test_other_date_format(self):
        """그 외 → 'M월 D일 (요일)' 형식"""
        # 오늘/어제가 아닌 과거 날짜 사용
        d = date(2025, 12, 25)  # 목요일
        result = format_korean_date(d)
        assert "12월" in result
        assert "25일" in result
        assert "(" in result and ")" in result

    def test_string_date_iso(self):
        """ISO 형식 문자열 입력 지원"""
        result = format_korean_date("2025-12-25")
        assert "12월" in result
        assert "25일" in result

    def test_string_today(self):
        """오늘 날짜 문자열도 '오늘' 반환"""
        today_str = date.today().isoformat()
        assert format_korean_date(today_str) == "오늘"


# ===== format_expense_saved =====


class TestFormatExpenseSaved:
    """지출 저장 성공 메시지"""

    def test_basic_format(self):
        """설명 + 금액이 첫 줄, 날짜 + 카테고리가 두 번째"""
        result = format_expense_saved(amount=8000, category="식비", description="김치찌개", date="2026-03-20")
        lines = result.strip().split("\n")
        first_line = lines[0]
        # 첫 줄에 설명과 금액
        assert "김치찌개" in first_line
        assert "8,000원" in first_line
        assert "기록" in first_line

    def test_contains_category(self):
        """카테고리 포함"""
        result = format_expense_saved(amount=8000, category="식비", description="김치찌개", date="2026-03-20")
        assert "식비" in result

    def test_contains_korean_date(self):
        """한국어 날짜 포맷 사용"""
        result = format_expense_saved(amount=8000, category="식비", description="김치찌개", date="2026-03-20")
        # ISO 날짜 대신 한국어 날짜
        assert "2026-03-20" not in result
        assert "3월" in result or "오늘" in result or "어제" in result

    def test_large_amount_comma(self):
        """큰 금액 천 단위 콤마"""
        result = format_expense_saved(amount=1500000, category="주거", description="월세", date="2026-02-01")
        assert "1,500,000원" in result

    def test_grape_emoji(self):
        """포도 이모지 사용"""
        result = format_expense_saved(amount=8000, category="식비", description="김치찌개", date="2026-03-20")
        assert "🍇" in result


# ===== format_income_saved =====


class TestFormatIncomeSaved:
    """수입 저장 성공 메시지"""

    def test_basic_format(self):
        """설명 + 금액 + '수입' 키워드"""
        result = format_income_saved(amount=3000000, category="급여", description="월급", date="2026-03-20")
        assert "월급" in result
        assert "3,000,000원" in result
        assert "수입" in result

    def test_contains_category(self):
        """카테고리 포함"""
        result = format_income_saved(amount=3000000, category="급여", description="월급", date="2026-03-20")
        assert "급여" in result

    def test_money_emoji(self):
        """돈 이모지 사용"""
        result = format_income_saved(amount=3000000, category="급여", description="월급", date="2026-03-20")
        assert "💰" in result


# ===== format_mixed_saved =====


class TestFormatMixedSaved:
    """수입/지출 혼합 저장 메시지"""

    def test_basic_counts(self):
        """건수와 총액 표시"""
        result = format_mixed_saved(expense_count=2, income_count=1, total_amount=50000)
        assert "지출 2건" in result
        assert "수입 1건" in result
        assert "50,000" in result

    def test_with_items(self):
        """개별 항목 표시"""
        items = [
            {"amount": 8000, "description": "김치찌개", "category": "식비", "type": "expense"},
            {"amount": 5000, "description": "커피", "category": "카페", "type": "expense"},
        ]
        result = format_mixed_saved(expense_count=2, income_count=0, total_amount=13000, items=items)
        assert "김치찌개" in result
        assert "커피" in result

    def test_expense_only(self):
        """지출만 있을 때"""
        result = format_mixed_saved(expense_count=3, income_count=0, total_amount=30000)
        assert "지출 3건" in result

    def test_income_only(self):
        """수입만 있을 때"""
        result = format_mixed_saved(expense_count=0, income_count=2, total_amount=100000)
        assert "수입 2건" in result


# ===== format_parse_error =====


class TestFormatParseError:
    """파싱 실패 메시지 — 3 Strike 패턴"""

    def test_strike_1(self):
        """Strike 1: 기본 안내"""
        result = format_parse_error(strike=1)
        assert "금액" in result
        assert "입력해보세요" in result or "입력해 보세요" in result

    def test_strike_2(self):
        """Strike 2: 다른 방식 제안"""
        result = format_parse_error(strike=2)
        assert "이해" in result or "못했어요" in result
        assert "금액을 먼저" in result or "다른 방식" in result

    def test_strike_3(self):
        """Strike 3+: 도움말 안내"""
        result = format_parse_error(strike=3)
        assert "도움말" in result or "어려운 표현" in result

    def test_strike_4_same_as_3(self):
        """Strike 4 이상은 3과 동일"""
        result3 = format_parse_error(strike=3)
        result4 = format_parse_error(strike=4)
        assert result3 == result4

    def test_default_is_strike_1(self):
        """기본값은 strike=1"""
        result_default = format_parse_error()
        result_1 = format_parse_error(strike=1)
        assert result_default == result_1

    def test_no_raw_input_param(self):
        """raw_input 파라미터 제거됨 — strike만 사용"""
        # strike 키워드만으로 호출 가능해야 함
        result = format_parse_error(strike=1)
        assert isinstance(result, str)


# ===== format_help_message =====


class TestFormatHelpMessage:
    """도움말 메시지"""

    def test_telegram_commands(self):
        """텔레그램: /report, /budget, /link, /help"""
        result = format_help_message(platform="telegram")
        assert "/report" in result
        assert "/budget" in result
        assert "/link" in result
        assert "/help" in result

    def test_kakao_commands(self):
        """카카오: 한글 명령어"""
        result = format_help_message(platform="kakao")
        assert "리포트" in result
        assert "예산" in result
        assert "취소" in result
        assert "변경" in result

    def test_telegram_length_limit(self):
        """텔레그램 도움말 500자 이내"""
        result = format_help_message(platform="telegram")
        assert len(result) <= 500

    def test_kakao_length_limit(self):
        """카카오 도움말 500자 이내"""
        result = format_help_message(platform="kakao")
        assert len(result) <= 500

    def test_has_examples(self):
        """입력 예시 포함"""
        result = format_help_message()
        assert "8000" in result or "8,000" in result


# ===== format_welcome_message =====


class TestFormatWelcomeMessage:
    """환영 메시지"""

    def test_contains_welcome(self):
        """'환영' 키워드"""
        result = format_welcome_message()
        assert "환영" in result

    def test_length_limit(self):
        """380자 이내"""
        result = format_welcome_message()
        assert len(result) <= 380

    def test_has_example(self):
        """사용 예시 포함"""
        result = format_welcome_message()
        # 최소 하나의 입력 예시
        assert "원" in result


# ===== format_link_usage_message =====


class TestFormatLinkUsageMessage:
    """연동 코드 사용법 — 텔레그램"""

    def test_has_link_command(self):
        from app.services.bot_messages import format_link_usage_message

        result = format_link_usage_message()
        assert "/link" in result

    def test_has_expiry(self):
        from app.services.bot_messages import format_link_usage_message

        result = format_link_usage_message()
        assert "만료" in result or "15분" in result


# ===== format_kakao_link_usage_message =====


class TestFormatKakaoLinkUsageMessage:
    """연동 코드 사용법 — 카카오"""

    def test_has_link_keyword(self):
        from app.services.bot_messages import format_kakao_link_usage_message

        result = format_kakao_link_usage_message()
        assert "연동" in result

    def test_has_expiry(self):
        from app.services.bot_messages import format_kakao_link_usage_message

        result = format_kakao_link_usage_message()
        assert "만료" in result or "15분" in result


# ===== format_delete_confirm =====


class TestFormatDeleteConfirm:
    """삭제 완료 메시지"""

    def test_basic_format(self):
        """설명 + 금액 + '삭제' 키워드"""
        result = format_delete_confirm(amount=8000, description="김치찌개")
        assert "8,000원" in result
        assert "김치찌개" in result
        assert "삭제" in result

    def test_backward_compat_kwargs(self):
        """category 파라미터 제거 — **kwargs로 무시"""
        # 기존 호출 코드가 category를 넘겨도 에러 안 남
        result = format_delete_confirm(amount=8000, description="김치찌개", category="식비")
        assert "8,000원" in result
        assert "삭제" in result


# ===== format_server_error =====


class TestFormatServerError:
    """서버 오류 메시지"""

    def test_retry_message(self):
        """'다시 시도' 키워드"""
        result = format_server_error()
        assert "다시 시도" in result

    def test_length_limit(self):
        """160자 이내"""
        result = format_server_error()
        assert len(result) <= 160


# ===== format_timeout_message =====


class TestFormatTimeoutMessage:
    """타임아웃 메시지"""

    def test_analysis_keyword(self):
        """'분석' 또는 '시간' 키워드"""
        result = format_timeout_message()
        assert "분석" in result or "시간" in result

    def test_retry_keyword(self):
        """'다시' 키워드"""
        result = format_timeout_message()
        assert "다시" in result


# ===== format_report_message =====


class TestFormatReportMessage:
    """이번 달 지출 리포트"""

    def test_empty_data(self):
        """데이터 없을 때"""
        result = format_report_message([])
        assert "리포트" in result
        assert "없어요" in result

    def test_top_3_only(self):
        """4개 이상이면 TOP 3만 표시"""
        data = [
            {"category": "식비", "total": 200000, "count": 20},
            {"category": "교통", "total": 100000, "count": 10},
            {"category": "카페", "total": 80000, "count": 8},
            {"category": "문화", "total": 50000, "count": 5},
            {"category": "의류", "total": 30000, "count": 3},
        ]
        result = format_report_message(data)
        assert "식비" in result
        assert "교통" in result
        assert "카페" in result
        # 4, 5위는 접힘
        assert "외 2개" in result

    def test_3_or_fewer_shows_all(self):
        """3개 이하면 전부 표시"""
        data = [
            {"category": "식비", "total": 200000, "count": 20},
            {"category": "교통", "total": 100000, "count": 10},
        ]
        result = format_report_message(data)
        assert "식비" in result
        assert "교통" in result
        assert "외" not in result

    def test_monthly_label(self):
        """월 라벨 포함"""
        data = [{"category": "식비", "total": 200000, "count": 20}]
        result = format_report_message(data)
        assert "📊" in result
        assert "월" in result
        assert "리포트" in result

    def test_total_amount(self):
        """총액 표시"""
        data = [
            {"category": "식비", "total": 200000, "count": 20},
            {"category": "교통", "total": 100000, "count": 10},
        ]
        result = format_report_message(data)
        assert "300,000원" in result

    def test_length_limit(self):
        """500자 이내"""
        data = [{"category": f"카테고리{i}", "total": 100000 - i * 10000, "count": 10 - i} for i in range(10)]
        result = format_report_message(data)
        assert len(result) <= 500

    def test_rank_numbers(self):
        """순위 번호 표시"""
        data = [
            {"category": "식비", "total": 200000, "count": 20},
            {"category": "교통", "total": 100000, "count": 10},
            {"category": "카페", "total": 80000, "count": 8},
        ]
        result = format_report_message(data)
        assert "1" in result
        assert "2" in result
        assert "3" in result


# ===== format_budget_status =====


class TestFormatBudgetStatus:
    """예산 현황"""

    def test_empty_data(self):
        """예산 없을 때"""
        result = format_budget_status([])
        assert "예산" in result
        assert "없어요" in result

    def test_severity_order(self):
        """초과 → 주의 → 안전 순서"""
        data = [
            {"category": "카페", "budget": 100000, "spent": 50000, "remaining": 50000, "usage": 50.0},
            {"category": "식비", "budget": 300000, "spent": 350000, "remaining": -50000, "usage": 116.7},
            {"category": "교통", "budget": 200000, "spent": 170000, "remaining": 30000, "usage": 85.0},
        ]
        result = format_budget_status(data)
        # 초과(식비)가 먼저, 주의(교통)가 다음
        pos_food = result.index("식비")
        pos_transport = result.index("교통")
        assert pos_food < pos_transport

    def test_safe_collapsed(self):
        """안전 항목은 접힘 — 'N개 카테고리 안전'"""
        data = [
            {"category": "식비", "budget": 300000, "spent": 350000, "remaining": -50000, "usage": 116.7},
            {"category": "카페", "budget": 100000, "spent": 50000, "remaining": 50000, "usage": 50.0},
            {"category": "교통", "budget": 100000, "spent": 30000, "remaining": 70000, "usage": 30.0},
            {"category": "문화", "budget": 80000, "spent": 20000, "remaining": 60000, "usage": 25.0},
        ]
        result = format_budget_status(data)
        # 안전 항목 3개가 접혀야 함
        assert "안전" in result
        assert "3개" in result

    def test_monthly_label(self):
        """월 라벨 포함"""
        data = [{"category": "식비", "budget": 300000, "spent": 150000, "remaining": 150000, "usage": 50.0}]
        result = format_budget_status(data)
        assert "💵" in result
        assert "월" in result
        assert "예산" in result

    def test_length_limit(self):
        """500자 이내"""
        data = [
            {"category": f"카테고리{i}", "budget": 100000, "spent": 80000 + i * 5000, "remaining": 20000 - i * 5000, "usage": 80 + i * 5} for i in range(10)
        ]
        result = format_budget_status(data)
        assert len(result) <= 500

    def test_over_budget_emoji(self):
        """초과 시 🚨 이모지"""
        data = [{"category": "식비", "budget": 300000, "spent": 350000, "remaining": -50000, "usage": 116.7}]
        result = format_budget_status(data)
        assert "🚨" in result

    def test_warning_emoji(self):
        """주의 시 ⚠️ 이모지"""
        data = [{"category": "교통", "budget": 200000, "spent": 170000, "remaining": 30000, "usage": 85.0}]
        result = format_budget_status(data)
        assert "⚠️" in result

    def test_all_safe_no_collapse(self):
        """전부 안전이면 접지 않고 전부 표시"""
        data = [
            {"category": "식비", "budget": 300000, "spent": 100000, "remaining": 200000, "usage": 33.3},
            {"category": "교통", "budget": 200000, "spent": 50000, "remaining": 150000, "usage": 25.0},
        ]
        result = format_budget_status(data)
        assert "식비" in result
        assert "교통" in result


# ===== format_unknown_input (backward compat) =====


class TestFormatUnknownInput:
    """format_unknown_input은 format_parse_error(strike=2)와 동일"""

    def test_backward_compat(self):
        """기존 호출과 호환"""
        result = format_unknown_input()
        assert isinstance(result, str)
        assert len(result) > 0
