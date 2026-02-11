from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import categories, chat, expenses, insights, telegram
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])


@app.get("/")
async def root():
    return {
        "message": "Welcome to HomeNRich API",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
