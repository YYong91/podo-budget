"""기존 유저를 Supabase Auth로 마이그레이션

Supabase Admin API로 유저를 생성하고, 비밀번호 재설정 이메일을 발송합니다.
생성 후 Supabase UUID를 가계부 DB의 auth_user_id에 업데이트합니다.

사용법:
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
  DATABASE_URL=postgresql+asyncpg://... \
  python scripts/migrate_users_to_supabase.py
"""

import asyncio
import os

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]

# 마이그레이션 대상 유저 (test 계정 제외)
USERS = [
    {"id": 1, "email": "kimsy_0327@naver.com", "name": "용용"},
    {"id": 3, "email": "conytallbet@naver.com", "name": "포도맘"},
    {"id": 4, "email": "whtmfal@gmail.com", "name": "조슬미"},
    {"id": 5, "email": "jsoojin_12@naver.com", "name": "조수진"},
    {"id": 6, "email": "hsl0516@naver.com", "name": "함석란"},
    {"id": 9, "email": "ekdowkd11@naver.com", "name": "최요원"},
    {"id": 13, "email": "radix7318@gmail.com", "name": "조준형"},
    {"id": 14, "email": "emscb@kakao.com", "name": "권혁민"},
    {"id": 16, "email": "minrumi@naver.com", "name": "민루미"},
]


async def create_supabase_user(client: httpx.AsyncClient, email: str, name: str) -> str | None:
    """Supabase Admin API로 유저 생성. UUID 반환."""
    resp = await client.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "email": email,
            "email_confirm": True,  # 이메일 인증 스킵 (이미 확인된 유저)
            "user_metadata": {"name": name},
        },
    )

    if resp.status_code == 200:
        data = resp.json()
        print(f"  ✅ {email} → {data['id']}")
        return data["id"]
    elif resp.status_code == 422 and "already been registered" in resp.text:
        # 이미 존재하는 유저 → ID 조회
        list_resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
        )
        if list_resp.status_code == 200:
            for u in list_resp.json().get("users", []):
                if u["email"] == email:
                    print(f"  ⏭️  {email} → 이미 존재 ({u['id']})")
                    return u["id"]
        print(f"  ❌ {email} → 이미 존재하지만 ID 조회 실패")
        return None
    else:
        print(f"  ❌ {email} → {resp.status_code}: {resp.text[:200]}")
        return None


async def update_auth_user_id(engine, user_id: int, supabase_uuid: str):
    """가계부 DB의 auth_user_id를 Supabase UUID로 업데이트."""
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET auth_user_id = :uuid WHERE id = :id"),
            {"uuid": supabase_uuid, "id": user_id},
        )


async def send_password_reset(client: httpx.AsyncClient, email: str):
    """비밀번호 재설정 이메일 발송."""
    resp = await client.post(
        f"{SUPABASE_URL}/auth/v1/recover",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
        },
        json={"email": email},
    )
    if resp.status_code == 200:
        print(f"  📧 {email} → 비밀번호 재설정 메일 발송")
    else:
        print(f"  ⚠️  {email} → 메일 발송 실패: {resp.status_code}")


async def main():
    engine = create_async_engine(DATABASE_URL, connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0})

    print(f"Supabase: {SUPABASE_URL}")
    print(f"유저 {len(USERS)}명 마이그레이션 시작\n")

    async with httpx.AsyncClient(timeout=30) as client:
        for user in USERS:
            print(f"[{user['id']}] {user['name']} ({user['email']})")

            # 1. Supabase 유저 생성
            supabase_uuid = await create_supabase_user(client, user["email"], user["name"])
            if not supabase_uuid:
                continue

            # 2. 가계부 DB auth_user_id 업데이트
            await update_auth_user_id(engine, user["id"], supabase_uuid)
            print(f"  🔗 auth_user_id → {supabase_uuid}")

            # 3. 비밀번호 재설정 메일 발송
            await send_password_reset(client, user["email"])
            print()

    await engine.dispose()
    print("✅ 마이그레이션 완료!")


if __name__ == "__main__":
    asyncio.run(main())
