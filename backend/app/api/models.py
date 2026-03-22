from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.providers import (
    get_provider, list_all_providers,
    ProviderError, AuthenticationError, RateLimitError, NetworkError
)

router = APIRouter(tags=["models"])


# ==================== Response Schemas ====================

class ModelItem(BaseModel):
    """模型信息"""
    id: str
    name: str
    max_tokens: int


class ProviderModels(BaseModel):
    """提供商及其模型列表"""
    provider: str
    models: List[ModelItem]


class ModelsResponse(BaseModel):
    """所有提供商模型列表响应"""
    providers: List[ProviderModels]


class TestConnectionRequest(BaseModel):
    """测试连接请求"""
    provider: str
    api_key: str
    base_url: Optional[str] = None


class TestConnectionResponse(BaseModel):
    """测试连接响应"""
    success: bool
    message: str


# ==================== API Endpoints ====================

@router.get("/models", response_model=ModelsResponse)
async def get_all_models():
    """获取所有提供商及其支持的模型列表（无需API Key）"""
    providers = list_all_providers()
    return ModelsResponse(providers=providers)


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(request: TestConnectionRequest):
    """测试某个提供商的API Key是否有效"""
    try:
        provider = get_provider(
            provider_name=request.provider,
            api_key=request.api_key,
            base_url=request.base_url
        )
        await provider.test_connection()
        return TestConnectionResponse(
            success=True,
            message="连接成功"
        )
    except AuthenticationError as e:
        return TestConnectionResponse(
            success=False,
            message=str(e)
        )
    except RateLimitError as e:
        return TestConnectionResponse(
            success=False,
            message=str(e)
        )
    except NetworkError as e:
        return TestConnectionResponse(
            success=False,
            message=str(e)
        )
    except ProviderError as e:
        return TestConnectionResponse(
            success=False,
            message=str(e)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"未知错误: {str(e)}"
        )


# ==================== Dependency for extracting provider info from headers ====================

async def get_provider_from_headers(
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_provider: str = Header(..., alias="X-Provider"),
    x_base_url: Optional[str] = Header(None, alias="X-Base-URL"),
):
    """从请求头提取Provider信息的依赖"""
    try:
        provider = get_provider(
            provider_name=x_provider,
            api_key=x_api_key,
            base_url=x_base_url
        )
        return provider
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
