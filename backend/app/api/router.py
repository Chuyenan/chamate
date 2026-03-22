from fastapi import APIRouter

from app.api.models import router as models_router
from app.api.conversation import router as conversation_router
from app.api.chat import router as chat_router
from app.api.debate import router as debate_router

router = APIRouter()

# 注册子路由
router.include_router(models_router)
router.include_router(conversation_router)
router.include_router(chat_router)
router.include_router(debate_router)


@router.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok"}
