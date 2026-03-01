"""
포도가계부 시드 데이터 생성 스크립트

로컬 API 서버에 현실적인 2~3개월치 가계부 데이터를 생성합니다.
사용법: python backend/scripts/seed_data.py [--base-url http://localhost:8000]
"""

import argparse
import random
import sys
from datetime import date

import httpx

# ──────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────

USERS = [
    {"username": "yyong", "password": "test1234!", "email": "yyong@example.com"},  # pragma: allowlist secret
    {"username": "dahye", "password": "test1234!", "email": "dahye@example.com"},  # pragma: allowlist secret
]

HOUSEHOLD = {"name": "우리집", "description": "공동 가계부", "currency": "KRW"}

# 카테고리 (type: expense / income / both)
CATEGORIES = [
    # 지출 카테고리
    {"name": "식비", "type": "expense"},
    {"name": "카페/간식", "type": "expense"},
    {"name": "교통", "type": "expense"},
    {"name": "주거/관리비", "type": "expense"},
    {"name": "통신", "type": "expense"},
    {"name": "생활용품", "type": "expense"},
    {"name": "의류/미용", "type": "expense"},
    {"name": "의료", "type": "expense"},
    {"name": "문화/여가", "type": "expense"},
    {"name": "경조사", "type": "expense"},
    {"name": "보험", "type": "expense"},
    {"name": "구독서비스", "type": "expense"},
    {"name": "교육", "type": "expense"},
    {"name": "반려동물", "type": "expense"},
    {"name": "기타", "type": "expense"},
    # 수입 카테고리
    {"name": "급여", "type": "income"},
    {"name": "부수입", "type": "income"},
    {"name": "이자/배당", "type": "income"},
    {"name": "용돈", "type": "income"},
]

# ──────────────────────────────────────────────
# 지출 템플릿 (카테고리명, 설명, 최소금액, 최대금액, 월 빈도)
# ──────────────────────────────────────────────

EXPENSE_TEMPLATES_SHARED = [
    # 식비 - 공유 지출 (장보기, 외식)
    ("식비", "이마트 장보기", 40000, 90000, 4),
    ("식비", "쿠팡 식료품", 20000, 50000, 3),
    ("식비", "외식 - 고기집", 40000, 70000, 2),
    ("식비", "외식 - 일식", 30000, 50000, 1),
    ("식비", "배달음식", 20000, 35000, 3),
    ("식비", "주말 브런치", 25000, 40000, 2),
    # 주거/관리비
    ("주거/관리비", "아파트 관리비", 250000, 280000, 1),
    # 통신
    ("통신", "인터넷 요금", 33000, 33000, 1),
    # 생활용품
    ("생활용품", "다이소 생활용품", 10000, 30000, 2),
    ("생활용품", "쿠팡 세제/휴지", 15000, 35000, 1),
    # 문화/여가
    ("문화/여가", "CGV 영화", 24000, 30000, 1),
    ("문화/여가", "주말 나들이", 20000, 50000, 2),
    # 구독서비스
    ("구독서비스", "넷플릭스", 17000, 17000, 1),
    ("구독서비스", "유튜브 프리미엄", 14900, 14900, 1),
    ("구독서비스", "멜론", 10900, 10900, 1),
    # 보험
    ("보험", "실비보험 (2인)", 120000, 120000, 1),
    # 반려동물
    ("반려동물", "고양이 사료", 35000, 45000, 1),
    ("반려동물", "고양이 모래", 15000, 20000, 1),
]

EXPENSE_TEMPLATES_YYONG = [
    # 개인 지출 - yyong
    ("식비", "점심 - 회사 근처", 8000, 13000, 18),
    ("카페/간식", "스타벅스 아메리카노", 4500, 6500, 10),
    ("교통", "교통카드 충전", 50000, 50000, 1),
    ("교통", "택시", 8000, 18000, 2),
    ("통신", "휴대폰 요금", 55000, 55000, 1),
    ("의류/미용", "미용실", 20000, 25000, 1),
    ("교육", "온라인 강의 (Udemy)", 15000, 30000, 1),
]

EXPENSE_TEMPLATES_DAHYE = [
    # 개인 지출 - dahye
    ("식비", "점심 - 회사 근처", 8000, 12000, 16),
    ("카페/간식", "투썸 케이크세트", 8000, 12000, 6),
    ("교통", "교통카드 충전", 50000, 50000, 1),
    ("통신", "휴대폰 요금", 52000, 52000, 1),
    ("의류/미용", "미용실", 40000, 60000, 1),
    ("의류/미용", "올리브영", 15000, 40000, 2),
    ("의료", "병원 진료", 10000, 30000, 1),
]

# 특별 지출 (특정 월에만 발생)
SPECIAL_EXPENSES = {
    12: [  # 12월
        ("경조사", "연말 선물", 50000, 100000),
        ("의류/미용", "겨울 코트", 150000, 250000),
        ("문화/여가", "송년회", 50000, 70000),
    ],
    1: [  # 1월
        ("경조사", "세뱃돈 (조카들)", 100000, 200000),
        ("식비", "설 명절 장보기", 100000, 200000),
        ("교통", "설 귀성 KTX", 100000, 120000),
    ],
    2: [  # 2월
        ("의류/미용", "봄 옷 쇼핑", 80000, 150000),
        ("반려동물", "고양이 건강검진", 80000, 120000),
    ],
}

# ──────────────────────────────────────────────
# 수입 템플릿
# ──────────────────────────────────────────────

INCOME_TEMPLATES_YYONG = [
    ("급여", "2월 월급", 3500000, 3500000, 1),
    ("부수입", "프리랜서 작업", 300000, 800000, 1),  # 매월은 아님
]

INCOME_TEMPLATES_DAHYE = [
    ("급여", "2월 월급", 2800000, 2800000, 1),
]

# ──────────────────────────────────────────────
# 정기 거래 템플릿
# ──────────────────────────────────────────────

RECURRING_TEMPLATES = [
    # (type, description, amount, frequency, day_of_month, category_name)
    ("expense", "아파트 관리비", 265000, "monthly", 10, "주거/관리비"),
    ("expense", "인터넷 요금", 33000, "monthly", 5, "통신"),
    ("expense", "넷플릭스", 17000, "monthly", 15, "구독서비스"),
    ("expense", "유튜브 프리미엄", 14900, "monthly", 15, "구독서비스"),
    ("expense", "멜론", 10900, "monthly", 1, "구독서비스"),
    ("expense", "실비보험", 120000, "monthly", 20, "보험"),
    ("expense", "고양이 사료 정기배송", 40000, "monthly", 1, "반려동물"),
    ("income", "yyong 월급", 3500000, "monthly", 25, "급여"),
    ("income", "dahye 월급", 2800000, "monthly", 25, "급여"),
]

# ──────────────────────────────────────────────
# 예산 템플릿 (카테고리명, 월 예산)
# ──────────────────────────────────────────────

BUDGET_TEMPLATES = [
    ("식비", 800000),
    ("카페/간식", 100000),
    ("교통", 150000),
    ("주거/관리비", 300000),
    ("통신", 150000),
    ("생활용품", 100000),
    ("의류/미용", 200000),
    ("의료", 100000),
    ("문화/여가", 200000),
    ("구독서비스", 50000),
    ("보험", 130000),
    ("반려동물", 100000),
]


# ──────────────────────────────────────────────
# API 헬퍼
# ──────────────────────────────────────────────


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(base_url=self.base_url, timeout=30, follow_redirects=True)
        self.token: str | None = None

    def _headers(self) -> dict:
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}

    def register(self, username: str, password: str, email: str) -> dict | None:
        r = self.client.post(
            "/api/auth/register",
            json={"username": username, "password": password, "email": email},
        )
        if r.status_code == 201:
            print(f"  [+] 사용자 등록: {username}")
            return r.json()
        if r.status_code == 400 and "이미 존재" in r.text:
            print(f"  [=] 사용자 이미 존재: {username}")
            return None
        print(f"  [!] 등록 실패 ({r.status_code}): {r.text}")
        return None

    def login(self, username: str, password: str) -> str:
        r = self.client.post(
            "/api/auth/login",
            json={"username": username, "password": password},
        )
        r.raise_for_status()
        self.token = r.json()["access_token"]
        print(f"  [+] 로그인: {username}")
        return self.token

    def create_household(self, data: dict) -> dict:
        r = self.client.post("/api/households", json=data, headers=self._headers())
        r.raise_for_status()
        result = r.json()
        print(f"  [+] 가구 생성: {result['name']} (id={result['id']})")
        return result

    def get_households(self) -> list:
        r = self.client.get("/api/households", headers=self._headers())
        r.raise_for_status()
        return r.json()

    def invite_member(self, household_id: int, email: str) -> dict | None:
        r = self.client.post(
            f"/api/households/{household_id}/invitations",
            json={"email": email, "role": "member"},
            headers=self._headers(),
        )
        if r.status_code == 201:
            result = r.json()
            print(f"  [+] 초대 발송: {email} (token={result.get('token', 'N/A')[:8]}...)")
            return result
        print(f"  [!] 초대 실패 ({r.status_code}): {r.text}")
        return None

    def accept_invitation(self, token: str) -> dict:
        r = self.client.post(
            f"/api/invitations/{token}/accept",
            headers=self._headers(),
        )
        r.raise_for_status()
        print("  [+] 초대 수락 완료")
        return r.json()

    def create_category(self, name: str, cat_type: str) -> dict:
        r = self.client.post(
            "/api/categories",
            json={"name": name, "type": cat_type},
            headers=self._headers(),
        )
        if r.status_code == 201:
            result = r.json()
            return result
        # 이미 존재하면 목록에서 찾기
        cats = self.client.get("/api/categories", headers=self._headers())
        for c in cats.json():
            if c["name"] == name:
                return c
        print(f"  [!] 카테고리 생성 실패 ({r.status_code}): {r.text}")
        return {"id": None, "name": name}

    def create_expense(self, data: dict) -> dict | None:
        r = self.client.post("/api/expenses", json=data, headers=self._headers())
        if r.status_code == 201:
            return r.json()
        print(f"  [!] 지출 생성 실패 ({r.status_code}): {r.text}")
        return None

    def create_income(self, data: dict) -> dict | None:
        r = self.client.post("/api/income", json=data, headers=self._headers())
        if r.status_code == 201:
            return r.json()
        print(f"  [!] 수입 생성 실패 ({r.status_code}): {r.text}")
        return None

    def create_budget(self, data: dict) -> dict | None:
        r = self.client.post("/api/budgets", json=data, headers=self._headers())
        if r.status_code == 201:
            return r.json()
        print(f"  [!] 예산 생성 실패 ({r.status_code}): {r.text}")
        return None

    def create_recurring(self, data: dict) -> dict | None:
        r = self.client.post("/api/recurring", json=data, headers=self._headers())
        if r.status_code == 201:
            return r.json()
        print(f"  [!] 정기거래 생성 실패 ({r.status_code}): {r.text}")
        return None


# ──────────────────────────────────────────────
# 데이터 생성 로직
# ──────────────────────────────────────────────


def random_date_in_month(year: int, month: int) -> date:
    """해당 월의 랜덤 날짜 반환 (1~28일)"""
    day = random.randint(1, 28)
    return date(year, month, day)


def generate_expenses_for_month(
    templates: list[tuple],
    year: int,
    month: int,
) -> list[dict]:
    """템플릿 기반으로 한 달치 지출 데이터 생성"""
    expenses = []
    for cat_name, desc, min_amt, max_amt, freq in templates:
        # 빈도에 약간의 랜덤 변동 (-1 ~ +1)
        actual_freq = max(0, freq + random.randint(-1, 1))
        for _ in range(actual_freq):
            d = random_date_in_month(year, month)
            amount = round(random.randint(min_amt // 100, max_amt // 100) * 100)
            # 월 이름으로 설명 커스터마이즈
            description = desc.replace("2월", f"{month}월")
            expenses.append(
                {
                    "category_name": cat_name,
                    "description": description,
                    "amount": amount,
                    "date": f"{d.isoformat()}T{random.randint(7, 21):02d}:{random.randint(0, 59):02d}:00",
                }
            )
    return expenses


def generate_income_for_month(
    templates: list[tuple],
    year: int,
    month: int,
) -> list[dict]:
    """한 달치 수입 데이터 생성"""
    incomes = []
    for cat_name, desc, min_amt, max_amt, _freq in templates:
        # 부수입은 50% 확률
        if "프리랜서" in desc and random.random() < 0.5:
            continue
        description = desc.replace("2월", f"{month}월")
        amount = round(random.randint(min_amt // 100, max_amt // 100) * 100)
        # 급여는 25일
        d = date(year, month, 25) if "월급" in desc else random_date_in_month(year, month)
        incomes.append(
            {
                "category_name": cat_name,
                "description": description,
                "amount": amount,
                "date": f"{d.isoformat()}T09:00:00",
            }
        )
    return incomes


# ──────────────────────────────────────────────
# 메인 실행
# ──────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="포도가계부 시드 데이터 생성")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="API 서버 URL (기본: http://localhost:8000)",
    )
    args = parser.parse_args()

    api = ApiClient(args.base_url)
    random.seed(42)  # 재현 가능한 결과

    # ── 1. 서버 연결 확인 ──
    print("\n🍇 포도가계부 시드 데이터 생성")
    print(f"   서버: {args.base_url}")
    try:
        r = api.client.get("/health")
        r.raise_for_status()
        print("   서버 연결: OK\n")
    except Exception as e:
        print(f"\n❌ 서버 연결 실패: {e}")
        print("   docker-compose up -d 또는 uvicorn을 먼저 실행해주세요.")
        sys.exit(1)

    # ── 2. 사용자 등록 + 로그인 ──
    print("📌 1단계: 사용자 등록")
    for u in USERS:
        api.register(u["username"], u["password"], u["email"])

    # yyong 로그인
    print("\n📌 2단계: 가구 생성 + 초대")
    api.login(USERS[0]["username"], USERS[0]["password"])

    # ── 3. 가구 생성 ──
    existing = api.get_households()
    if existing:
        household = existing[0]
        household_id = household["id"]
        print(f"  [=] 기존 가구 사용: {household['name']} (id={household_id})")
    else:
        household = api.create_household(HOUSEHOLD)
        household_id = household["id"]

    # ── 4. 멤버 초대 ──
    invitation = api.invite_member(household_id, USERS[1]["email"])

    # dahye 로그인 → 초대 수락
    if invitation and invitation.get("token"):
        api.login(USERS[1]["username"], USERS[1]["password"])
        api.accept_invitation(invitation["token"])

    # ── 5. 카테고리 생성 (두 사용자 모두) ──
    print("\n📌 3단계: 카테고리 생성")
    # 각 사용자별 카테고리 ID 매핑
    user_category_maps: dict[str, dict[str, int]] = {}

    for user in USERS:
        api.login(user["username"], user["password"])
        cat_map: dict[str, int] = {}
        for cat in CATEGORIES:
            result = api.create_category(cat["name"], cat["type"])
            if result.get("id"):
                cat_map[cat["name"]] = result["id"]
        user_category_maps[user["username"]] = cat_map
        print(f"  [+] {user['username']}: {len(cat_map)}개 카테고리")

    # ── 6. 지출 데이터 생성 (3개월) ──
    print("\n📌 4단계: 지출 데이터 생성 (3개월)")
    months = [(2025, 12), (2026, 1), (2026, 2)]
    total_expenses = 0

    for year, month in months:
        print(f"\n  📅 {year}년 {month}월:")

        # yyong 지출
        api.login(USERS[0]["username"], USERS[0]["password"])
        cat_map = user_category_maps[USERS[0]["username"]]

        # 공유 지출 (yyong이 입력)
        shared = generate_expenses_for_month(EXPENSE_TEMPLATES_SHARED, year, month)
        personal = generate_expenses_for_month(EXPENSE_TEMPLATES_YYONG, year, month)

        for exp in shared + personal:
            cat_id = cat_map.get(exp["category_name"])
            result = api.create_expense(
                {
                    "amount": exp["amount"],
                    "description": exp["description"],
                    "date": exp["date"],
                    "category_id": cat_id,
                    "household_id": household_id,
                }
            )
            if result:
                total_expenses += 1

        count_yyong = len(shared) + len(personal)
        print(f"    yyong: {count_yyong}건")

        # dahye 지출
        api.login(USERS[1]["username"], USERS[1]["password"])
        cat_map = user_category_maps[USERS[1]["username"]]

        dahye_expenses = generate_expenses_for_month(EXPENSE_TEMPLATES_DAHYE, year, month)
        for exp in dahye_expenses:
            cat_id = cat_map.get(exp["category_name"])
            result = api.create_expense(
                {
                    "amount": exp["amount"],
                    "description": exp["description"],
                    "date": exp["date"],
                    "category_id": cat_id,
                    "household_id": household_id,
                }
            )
            if result:
                total_expenses += 1

        print(f"    dahye: {len(dahye_expenses)}건")

        # 특별 지출 (yyong이 입력)
        if month in SPECIAL_EXPENSES:
            api.login(USERS[0]["username"], USERS[0]["password"])
            cat_map = user_category_maps[USERS[0]["username"]]

            for cat_name, desc, min_amt, max_amt in SPECIAL_EXPENSES[month]:
                d = random_date_in_month(year, month)
                amount = round(random.randint(min_amt // 100, max_amt // 100) * 100)
                cat_id = cat_map.get(cat_name)
                result = api.create_expense(
                    {
                        "amount": amount,
                        "description": desc,
                        "date": f"{d.isoformat()}T14:00:00",
                        "category_id": cat_id,
                        "household_id": household_id,
                    }
                )
                if result:
                    total_expenses += 1
                    print(f"    특별: {desc} ({amount:,}원)")

    print(f"\n  총 지출: {total_expenses}건")

    # ── 7. 수입 데이터 생성 ──
    print("\n📌 5단계: 수입 데이터 생성")
    total_incomes = 0

    for year, month in months:
        # yyong 수입
        api.login(USERS[0]["username"], USERS[0]["password"])
        cat_map = user_category_maps[USERS[0]["username"]]

        for inc in generate_income_for_month(INCOME_TEMPLATES_YYONG, year, month):
            cat_id = cat_map.get(inc["category_name"])
            result = api.create_income(
                {
                    "amount": inc["amount"],
                    "description": inc["description"],
                    "date": inc["date"],
                    "category_id": cat_id,
                    "household_id": household_id,
                }
            )
            if result:
                total_incomes += 1
                print(f"  [+] {inc['description']}: {inc['amount']:,.0f}원")

        # dahye 수입
        api.login(USERS[1]["username"], USERS[1]["password"])
        cat_map = user_category_maps[USERS[1]["username"]]

        for inc in generate_income_for_month(INCOME_TEMPLATES_DAHYE, year, month):
            cat_id = cat_map.get(inc["category_name"])
            result = api.create_income(
                {
                    "amount": inc["amount"],
                    "description": inc["description"],
                    "date": inc["date"],
                    "category_id": cat_id,
                    "household_id": household_id,
                }
            )
            if result:
                total_incomes += 1
                print(f"  [+] {inc['description']}: {inc['amount']:,.0f}원")

    print(f"\n  총 수입: {total_incomes}건")

    # ── 8. 예산 설정 (yyong) ──
    print("\n📌 6단계: 예산 설정")
    api.login(USERS[0]["username"], USERS[0]["password"])
    cat_map = user_category_maps[USERS[0]["username"]]

    today = date.today()
    budget_start = date(today.year, today.month, 1)
    budget_count = 0

    for cat_name, amount in BUDGET_TEMPLATES:
        cat_id = cat_map.get(cat_name)
        if not cat_id:
            continue
        result = api.create_budget(
            {
                "category_id": cat_id,
                "amount": amount,
                "period": "monthly",
                "start_date": f"{budget_start.isoformat()}T00:00:00",
                "alert_threshold": 0.8,
            }
        )
        if result:
            budget_count += 1

    print(f"  [+] {budget_count}개 예산 설정 완료")

    # ── 9. 정기 거래 등록 (yyong) ──
    print("\n📌 7단계: 정기 거래 등록")
    recurring_count = 0

    for tx_type, desc, amount, freq, dom, cat_name in RECURRING_TEMPLATES:
        cat_id = cat_map.get(cat_name)
        result = api.create_recurring(
            {
                "type": tx_type,
                "amount": amount,
                "description": desc,
                "category_id": cat_id,
                "frequency": freq,
                "day_of_month": dom,
                "start_date": "2025-12-01",
                "household_id": household_id,
            }
        )
        if result:
            recurring_count += 1
            print(f"  [+] {desc}: {amount:,.0f}원/{freq}")

    print(f"\n  총 정기거래: {recurring_count}건")

    # ── 완료 ──
    print("\n" + "=" * 50)
    print("🍇 시드 데이터 생성 완료!")
    print(f"   사용자: {len(USERS)}명")
    print(f"   가구: 1개 ('{HOUSEHOLD['name']}')")
    print(f"   카테고리: {len(CATEGORIES)}개/사용자")
    print(f"   지출: {total_expenses}건")
    print(f"   수입: {total_incomes}건")
    print(f"   예산: {budget_count}개")
    print(f"   정기거래: {recurring_count}건")
    print("\n   로그인 정보:")
    for u in USERS:
        print(f"     {u['username']} / {u['password']}")
    print("=" * 50)


if __name__ == "__main__":
    main()
