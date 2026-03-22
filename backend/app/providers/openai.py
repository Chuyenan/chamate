from typing import AsyncGenerator, List, Optional
from openai import AsyncOpenAI
import httpx

from .base import (
    BaseProvider, ModelInfo,
    ProviderError, AuthenticationError, RateLimitError, NetworkError
)


class OpenAIProvider(BaseProvider):
    """OpenAI Provider实现"""
    
    provider_name: str = "openai"
    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    
    SUPPORTED_MODELS = [
        ModelInfo(id="gpt-4o", name="GPT-4o", provider="openai", max_tokens=128000),
        ModelInfo(id="gpt-4o-mini", name="GPT-4o Mini", provider="openai", max_tokens=128000),
        ModelInfo(id="gpt-4-turbo", name="GPT-4 Turbo", provider="openai", max_tokens=128000),
        ModelInfo(id="gpt-3.5-turbo", name="GPT-3.5 Turbo", provider="openai", max_tokens=16385),
    ]
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        super().__init__(api_key, base_url)
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or self.DEFAULT_BASE_URL,
        )
    
    async def chat(self, messages: List[dict], model: str, **kwargs) -> str:
        """同步对话，返回完整回复"""
        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                **kwargs
            )
            return response.choices[0].message.content or ""
        except httpx.ConnectError as e:
            raise NetworkError(f"网络连接失败: {str(e)}")
        except Exception as e:
            self._handle_error(e)
    
    async def stream_chat(self, messages: List[dict], model: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式对话，yield每个token"""
        try:
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                **kwargs
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except httpx.ConnectError as e:
            raise NetworkError(f"网络连接失败: {str(e)}")
        except Exception as e:
            self._handle_error(e)
    
    async def test_connection(self) -> bool:
        """测试API连接是否正常"""
        try:
            await self.client.models.list()
            return True
        except Exception as e:
            self._handle_error(e)
    
    def list_models(self) -> List[ModelInfo]:
        """返回支持的模型列表"""
        return self.SUPPORTED_MODELS
    
    def _handle_error(self, e: Exception):
        """统一处理异常"""
        error_msg = str(e)
        if "401" in error_msg or "invalid_api_key" in error_msg.lower():
            raise AuthenticationError("API Key无效或已过期")
        elif "429" in error_msg or "rate_limit" in error_msg.lower():
            raise RateLimitError("请求频率超限，请稍后重试")
        elif "connection" in error_msg.lower() or "network" in error_msg.lower():
            raise NetworkError(f"网络连接失败: {error_msg}")
        else:
            raise ProviderError(f"OpenAI API错误: {error_msg}")
