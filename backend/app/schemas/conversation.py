from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# ==================== Conversation Schemas ====================

class ConversationCreate(BaseModel):
    """创建对话请求"""
    title: Optional[str] = "新对话"


class ConversationUpdate(BaseModel):
    """更新对话请求"""
    title: Optional[str] = None


class MessageResponse(BaseModel):
    """消息响应"""
    id: str
    conversation_id: str
    role: str
    content: str
    model: Optional[str] = None
    provider: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """对话响应"""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []
    
    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    """对话列表响应"""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Debate Schemas ====================

class DebateCreate(BaseModel):
    """创建辩论请求"""
    topic: str
    user_stance: str


class DebateRoundResponse(BaseModel):
    """辩论回合响应"""
    id: str
    debate_id: str
    round_number: int
    pro_argument: Optional[str] = None
    con_argument: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DebateResponse(BaseModel):
    """辩论响应"""
    id: str
    topic: str
    user_stance: str
    status: str
    created_at: datetime
    updated_at: datetime
    rounds: List[DebateRoundResponse] = []
    
    class Config:
        from_attributes = True


class DebateListResponse(BaseModel):
    """辩论列表响应"""
    id: str
    topic: str
    user_stance: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Chat Schemas ====================

class ChatRequest(BaseModel):
    """聊天请求"""
    conversation_id: str
    message: str
    model: str
    provider: str


# ==================== Debate Round Request ====================

class DebateRoundRequest(BaseModel):
    """辩论轮次请求"""
    model: str
    provider: str


class DebateSummaryRequest(BaseModel):
    """辩论总结请求"""
    model: str
    provider: str
