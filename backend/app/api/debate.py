import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db, SessionLocal
from app.db.models import Debate, DebateRound
from app.schemas.conversation import (
    DebateCreate, DebateResponse, DebateListResponse,
    DebateRoundRequest, DebateRoundResponse, DebateSummaryRequest
)
from app.providers import get_provider, ProviderError

router = APIRouter(prefix="/debates", tags=["debates"])

# ==================== Prompt Templates ====================

PRO_SYSTEM_PROMPT = """你是一位辩论赛的正方辩手。你需要坚定地支持并论证以下立场："{stance}"

辩论主题：{topic}

请基于逻辑、事实和有说服力的论证来支持你的立场。保持专业、理性的辩论态度。
如果有之前的辩论轮次，请针对反方的观点进行有效的反驳和回应。"""

CON_SYSTEM_PROMPT = """你是一位辩论赛的反方辩手。你需要坚定地反对以下立场："{stance}"

辩论主题：{topic}

请基于逻辑、事实和有说服力的论证来反驳正方的立场。保持专业、理性的辩论态度。
如果有之前的辩论轮次，请针对正方的观点进行有效的反驳和回应。"""

SUMMARY_SYSTEM_PROMPT = """你是一位专业的辩论评委和分析师。请对以下辩论进行全面总结和分析。

辩论主题：{topic}
用户立场：{stance}

请从以下几个方面进行总结：
1. **共识点**：双方在哪些方面观点一致或接近
2. **分歧点**：双方的核心分歧在哪里
3. **论证分析**：双方各自的强弱点
4. **建议**：对这个议题的理性看法和建议

请保持客观、全面、深入的分析。"""


@router.post("", response_model=DebateResponse)
async def create_debate(data: DebateCreate, db: Session = Depends(get_db)):
    """创建辩论"""
    debate = Debate(topic=data.topic, user_stance=data.user_stance)
    db.add(debate)
    db.commit()
    db.refresh(debate)
    return debate


@router.get("", response_model=List[DebateListResponse])
async def list_debates(db: Session = Depends(get_db)):
    """辩论列表（按created_at降序）"""
    debates = db.query(Debate).order_by(Debate.created_at.desc()).all()
    return debates


@router.get("/{debate_id}", response_model=DebateResponse)
async def get_debate(debate_id: str, db: Session = Depends(get_db)):
    """辩论详情（含所有轮次）"""
    debate = db.query(Debate).filter(Debate.id == debate_id).first()
    if not debate:
        raise HTTPException(status_code=404, detail="辩论不存在")
    return debate


@router.post("/{debate_id}/rounds")
async def execute_debate_round(
    debate_id: str,
    request: DebateRoundRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_base_url: Optional[str] = Header(None, alias="X-Base-URL"),
    db: Session = Depends(get_db)
):
    """执行一轮辩论（SSE流式返回正反方论点）"""
    # 获取辩论详情
    debate = db.query(Debate).filter(Debate.id == debate_id).first()
    if not debate:
        raise HTTPException(status_code=404, detail="辩论不存在")
    
    if debate.status == "completed":
        raise HTTPException(status_code=400, detail="辩论已结束")
    
    # 获取已有轮次
    existing_rounds = db.query(DebateRound).filter(
        DebateRound.debate_id == debate_id
    ).order_by(DebateRound.round_number).all()
    
    current_round = len(existing_rounds) + 1
    
    # 获取 Provider
    try:
        provider = get_provider(
            provider_name=request.provider,
            api_key=x_api_key,
            base_url=x_base_url
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 构建历史上下文
    history_context = ""
    for r in existing_rounds:
        history_context += f"\n第{r.round_number}轮：\n正方：{r.pro_argument}\n反方：{r.con_argument}\n"
    
    # 保存生成器需要的信息
    topic = debate.topic
    stance = debate.user_stance
    model = request.model
    
    async def generate_sse():
        pro_response = ""
        con_response = ""
        error_occurred = False
        
        try:
            # 构建正方消息
            pro_system = PRO_SYSTEM_PROMPT.format(stance=stance, topic=topic)
            pro_messages = [{"role": "system", "content": pro_system}]
            if history_context:
                pro_messages.append({
                    "role": "user", 
                    "content": f"以下是之前的辩论轮次：{history_context}\n\n请继续发表你的第{current_round}轮观点。"
                })
            else:
                pro_messages.append({
                    "role": "user", 
                    "content": "请发表你的开场论述。"
                })
            
            # 流式生成正方论点
            async for token in provider.stream_chat(pro_messages, model):
                pro_response += token
                yield f"data: {json.dumps({'type': 'pro', 'content': token})}\n\n"
            yield f"data: {json.dumps({'type': 'pro_done'})}\n\n"
            
            # 构建反方消息
            con_system = CON_SYSTEM_PROMPT.format(stance=stance, topic=topic)
            con_messages = [{"role": "system", "content": con_system}]
            
            updated_history = history_context + f"\n第{current_round}轮：\n正方：{pro_response}\n"
            con_messages.append({
                "role": "user", 
                "content": f"以下是辩论内容：{updated_history}\n\n请针对正方观点进行反驳。"
            })
            
            # 流式生成反方论点
            async for token in provider.stream_chat(con_messages, model):
                con_response += token
                yield f"data: {json.dumps({'type': 'con', 'content': token})}\n\n"
            yield f"data: {json.dumps({'type': 'con_done'})}\n\n"
            
            yield "data: [DONE]\n\n"
            
        except ProviderError as e:
            error_occurred = True
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            error_occurred = True
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # 保存辩论轮次到数据库
            if pro_response and con_response and not error_occurred:
                save_db = SessionLocal()
                try:
                    debate_round = DebateRound(
                        debate_id=debate_id,
                        round_number=current_round,
                        pro_argument=pro_response,
                        con_argument=con_response
                    )
                    save_db.add(debate_round)
                    
                    # 更新辩论的 updated_at
                    d = save_db.query(Debate).filter(Debate.id == debate_id).first()
                    if d:
                        d.updated_at = datetime.utcnow()
                    
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


@router.post("/{debate_id}/summary")
async def generate_debate_summary(
    debate_id: str,
    request: DebateSummaryRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_base_url: Optional[str] = Header(None, alias="X-Base-URL"),
    db: Session = Depends(get_db)
):
    """生成辩论总结（SSE流式返回）"""
    # 获取辩论详情
    debate = db.query(Debate).filter(Debate.id == debate_id).first()
    if not debate:
        raise HTTPException(status_code=404, detail="辩论不存在")
    
    # 获取所有轮次
    rounds = db.query(DebateRound).filter(
        DebateRound.debate_id == debate_id
    ).order_by(DebateRound.round_number).all()
    
    if not rounds:
        raise HTTPException(status_code=400, detail="辩论还没有任何轮次，无法生成总结")
    
    # 获取 Provider
    try:
        provider = get_provider(
            provider_name=request.provider,
            api_key=x_api_key,
            base_url=x_base_url
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 构建辩论内容
    debate_content = ""
    for r in rounds:
        debate_content += f"\n【第{r.round_number}轮】\n正方观点：{r.pro_argument}\n\n反方观点：{r.con_argument}\n"
    
    # 保存生成器需要的信息
    topic = debate.topic
    stance = debate.user_stance
    model = request.model
    
    async def generate_sse():
        summary_response = ""
        error_occurred = False
        
        try:
            # 构建总结消息
            system_prompt = SUMMARY_SYSTEM_PROMPT.format(topic=topic, stance=stance)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"以下是完整的辩论记录：{debate_content}\n\n请生成全面的辩论总结。"}
            ]
            
            # 流式生成总结
            async for token in provider.stream_chat(messages, model):
                summary_response += token
                yield f"data: {json.dumps({'content': token})}\n\n"
            yield "data: [DONE]\n\n"
            
        except ProviderError as e:
            error_occurred = True
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            error_occurred = True
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # 更新辩论状态为 completed
            if summary_response and not error_occurred:
                save_db = SessionLocal()
                try:
                    d = save_db.query(Debate).filter(Debate.id == debate_id).first()
                    if d:
                        d.status = "completed"
                        d.updated_at = datetime.utcnow()
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
