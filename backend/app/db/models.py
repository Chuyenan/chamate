from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base


def uuid4_hex():
    """生成UUID hex字符串"""
    return uuid.uuid4().hex


class Conversation(Base):
    """对话模型"""
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True, default=uuid4_hex)
    title = Column(String, default="新对话")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """消息模型"""
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, default=uuid4_hex)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    model = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")


class Debate(Base):
    """辩论模型"""
    __tablename__ = "debates"
    
    id = Column(String, primary_key=True, default=uuid4_hex)
    topic = Column(String)
    user_stance = Column(Text)
    status = Column(String, default="active")  # active, completed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rounds = relationship("DebateRound", back_populates="debate", cascade="all, delete-orphan")


class DebateRound(Base):
    """辩论回合模型"""
    __tablename__ = "debate_rounds"
    
    id = Column(String, primary_key=True, default=uuid4_hex)
    debate_id = Column(String, ForeignKey("debates.id"))
    round_number = Column(Integer)
    pro_argument = Column(Text)
    con_argument = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    debate = relationship("Debate", back_populates="rounds")
