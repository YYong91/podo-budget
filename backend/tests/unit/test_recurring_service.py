"""정기 거래 서비스 단위 테스트

calculate_next_due_date, calculate_initial_due_date 순수 함수 테스트
"""

from datetime import date

import pytest

from app.services.recurring_service import calculate_initial_due_date, calculate_next_due_date


class TestCalculateNextDueDate:
    """다음 실행 예정일 계산 테스트"""

    def test_weekly_7일_후(self):
        result = calculate_next_due_date(date(2026, 2, 16), "weekly")
        assert result == date(2026, 2, 23)

    def test_monthly_다음달(self):
        result = calculate_next_due_date(date(2026, 1, 15), "monthly", day_of_month=15)
        assert result == date(2026, 2, 15)

    def test_monthly_12월에서_1월(self):
        result = calculate_next_due_date(date(2026, 12, 25), "monthly", day_of_month=25)
        assert result == date(2027, 1, 25)

    def test_monthly_31일_짧은_달_조정(self):
        # 1월 31일 → 2월은 28일까지
        result = calculate_next_due_date(date(2026, 1, 31), "monthly", day_of_month=31)
        assert result == date(2026, 2, 28)

    def test_monthly_31일_윤년_2월(self):
        # 2028년은 윤년
        result = calculate_next_due_date(date(2028, 1, 31), "monthly", day_of_month=31)
        assert result == date(2028, 2, 29)

    def test_yearly_다음해(self):
        result = calculate_next_due_date(date(2026, 3, 15), "yearly", day_of_month=15, month_of_year=3)
        assert result == date(2027, 3, 15)

    def test_yearly_윤년_2월29일(self):
        # 2028년 윤년 → 2029년은 평년이므로 2월 28일
        result = calculate_next_due_date(date(2028, 2, 29), "yearly", day_of_month=29, month_of_year=2)
        assert result == date(2029, 2, 28)

    def test_custom_N일_후(self):
        result = calculate_next_due_date(date(2026, 2, 16), "custom", interval=14)
        assert result == date(2026, 3, 2)

    def test_custom_기본_1일(self):
        result = calculate_next_due_date(date(2026, 2, 16), "custom")
        assert result == date(2026, 2, 17)

    def test_알수없는_빈도_에러(self):
        with pytest.raises(ValueError, match="알 수 없는 빈도"):
            calculate_next_due_date(date(2026, 2, 16), "biweekly")


class TestCalculateInitialDueDate:
    """최초 실행 예정일 계산 테스트"""

    def test_weekly_같은날_요일이면_당일(self):
        # 2026-02-16은 월요일 (weekday=0)
        result = calculate_initial_due_date(date(2026, 2, 16), "weekly", day_of_week=0)
        assert result == date(2026, 2, 16)

    def test_weekly_미래_요일(self):
        # 2026-02-16(월) → 수요일(2)
        result = calculate_initial_due_date(date(2026, 2, 16), "weekly", day_of_week=2)
        assert result == date(2026, 2, 18)

    def test_weekly_지난_요일이면_다음주(self):
        # 2026-02-18(수) → 월요일(0) → 다음 주 월요일
        result = calculate_initial_due_date(date(2026, 2, 18), "weekly", day_of_week=0)
        assert result == date(2026, 2, 23)

    def test_monthly_당월_미래(self):
        # start_date가 2월 1일, day_of_month=15 → 2월 15일
        result = calculate_initial_due_date(date(2026, 2, 1), "monthly", day_of_month=15)
        assert result == date(2026, 2, 15)

    def test_monthly_당월_이미_지남(self):
        # start_date가 2월 20일, day_of_month=15 → 다음 달 3월 15일
        result = calculate_initial_due_date(date(2026, 2, 20), "monthly", day_of_month=15)
        assert result == date(2026, 3, 15)

    def test_monthly_당일이면_당일(self):
        result = calculate_initial_due_date(date(2026, 2, 15), "monthly", day_of_month=15)
        assert result == date(2026, 2, 15)

    def test_yearly_올해_미래(self):
        result = calculate_initial_due_date(date(2026, 1, 1), "yearly", day_of_month=15, month_of_year=3)
        assert result == date(2026, 3, 15)

    def test_yearly_올해_이미_지남(self):
        result = calculate_initial_due_date(date(2026, 6, 1), "yearly", day_of_month=15, month_of_year=3)
        assert result == date(2027, 3, 15)

    def test_custom_시작일_그대로(self):
        result = calculate_initial_due_date(date(2026, 2, 16), "custom")
        assert result == date(2026, 2, 16)

    def test_알수없는_빈도_에러(self):
        with pytest.raises(ValueError, match="알 수 없는 빈도"):
            calculate_initial_due_date(date(2026, 2, 16), "biweekly")
