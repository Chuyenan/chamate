import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse
from typing import Optional
from datetime import datetime

from app.db.database import get_db, SessionLocal
from app.db.models import Conversation, Message
from app.schemas.conversation import ChatRequest
from app.providers import get_provider, ProviderError

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(
    request: ChatRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_base_url: Optional[str] = Header(None, alias="X-Base-URL"),
    db: Session = Depends(get_db)
):
    """发送消息并获取AI回复（SSE流式响应）"""
    # 1. 验证 conversation_id 存在
    conversation = db.query(Conversation).filter(
        Conversation.id == request.conversation_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    # 2. 将用户消息存入 Message 表
    user_message = Message(
        conversation_id=request.conversation_id,
        role="user",
        content=request.message
    )
    db.add(user_message)
    
    # 检查是否是第一条消息（用于自动生成标题）
    is_first_message = len(conversation.messages) == 0
    
    db.commit()
    
    # 更新会话的 updated_at
    conversation.updated_at = datetime.utcnow()
    db.commit()
    
    # 3. 获取该会话的所有历史消息，构建 messages 列表
    messages_list = []
    all_messages = db.query(Message).filter(
        Message.conversation_id == request.conversation_id
    ).order_by(Message.created_at).all()
    
    for msg in all_messages:
        messages_list.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # 4. 获取 Provider
    try:
        provider = get_provider(
            provider_name=request.provider,
            api_key=x_api_key,
            base_url=x_base_url
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 保存生成器需要的信息
    conversation_id = request.conversation_id
    model = request.model
    provider_name = request.provider
    user_msg = request.message
    
    async def generate_sse():
        full_response = ""
        error_occurred = False
        
        try:
            async for token in provider.stream_chat(messages_list, model):
                full_response += token
                yield f"data: {json.dumps({'content': token})}\n\n"
            yield "data: [DONE]\n\n"
        except ProviderError as e:
            error_occurred = True
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            error_occurred = True
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # 在 generator 结束后保存 AI 回复到数据库
            if full_response and not error_occurred:
                # 创建新的 session 用于保存
                save_db = SessionLocal()
                try:
                    assistant_message = Message(
                        conversation_id=conversation_id,
                        role="assistant",
                        content=full_response,
                        model=model,
                        provider=provider_name
                    )
                    save_db.add(assistant_message)
                    
                    # 如果是第一条消息，自动生成标题
                    if is_first_message:
                        conv = save_db.query(Conversation).filter(
                            Conversation.id == conversation_id
                        ).first()
                        if conv and conv.title == "新对话":
                            # 截取用户消息前20个字符作为标题
                            title = user_msg[:20] + ("..." if len(user_msg) > 20 else "")
                            conv.title = title
                    
                    # 更新会话的 updated_at
                    conv = save_db.query(Conversation).filter(
                        Conversation.id == conversation_id
                    ).first()
                    if conv:
                        conv.updated_at = datetime.utcnow()
                    
                    save_db.commit()
                finally:
                    save_db.close()
    
    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
