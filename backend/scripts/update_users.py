"""계정 비밀번호 업데이트 스크립트"""

import asyncio

from passlib.context import CryptContext
from sqlalchemy import text

from app.core.database import AsyncSessionLocal

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def main():
    async with AsyncSessionLocal() as db:
        # 용용 (id=6)
        pw1 = "tmddyd123!"
        h1 = pwd.hash(pw1)
        await db.execute(
            text("UPDATE users SET username=:name, email=:email, hashed_password=:pw WHERE id=6"),
            {"name": "용용", "email": "kimsy_0327@naver.com", "pw": h1},
        )

        # 석화 (id=7)
        pw2 = "test1234!"
        h2 = pwd.hash(pw2)
        await db.execute(
            text("UPDATE users SET username=:name, email=:email, hashed_password=:pw WHERE id=7"),
            {"name": "석화", "email": "conytallbet@naver.com", "pw": h2},
        )

        await db.commit()

        # 검증: 비밀번호 확인
        result = await db.execute(text("SELECT id, username, email, hashed_password FROM users WHERE id IN (6,7)"))
        for r in result.fetchall():
            uid, uname, email, hpw = r
            ok = pwd.verify(pw1, hpw) if uid == 6 else pwd.verify(pw2, hpw)
            print(f"  {uname} ({email}) - 비밀번호 검증: {'OK' if ok else 'FAIL'}")


asyncio.run(main())
