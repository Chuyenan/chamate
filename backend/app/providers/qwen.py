from typing import AsyncGenerator, List, Optional
from openai import AsyncOpenAI
import httpx

from .base import (
    BaseProvider, ModelInfo,
    ProviderError, AuthenticationError, RateLimitError, NetworkError
)


class QwenProvider(BaseProvider):
    """通义千问 Provider实现（兼容OpenAI API格式）"""
    
    provider_name: str = "qwen"
    DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    
    SUPPORTED_MODELS = [
        # Qwen3.5 系列（最新）
        ModelInfo(id="qwen3.5-plus", name="Qwen3.5-Plus（最新）", provider="qwen", max_tokens=131072),
        # Qwen3 系列
        ModelInfo(id="qwen3-max", name="Qwen3-Max", provider="qwen", max_tokens=32768),
        ModelInfo(id="qwen3-235b-a22b", name="Qwen3-235B", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen3-30b-a3b", name="Qwen3-30B", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen3-32b", name="Qwen3-32B", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen3-14b", name="Qwen3-14B", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen3-8b", name="Qwen3-8B", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen3-4b", name="Qwen3-4B", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen3-1.7b", name="Qwen3-1.7B", provider="qwen", max_tokens=32768),
        ModelInfo(id="qwen3-0.6b", name="Qwen3-0.6B", provider="qwen", max_tokens=32768),
        # 通用别名版本
        ModelInfo(id="qwen-max-latest", name="Qwen-Max-Latest", provider="qwen", max_tokens=32768),
        ModelInfo(id="qwen-plus-latest", name="Qwen-Plus-Latest", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen-turbo-latest", name="Qwen-Turbo-Latest", provider="qwen", max_tokens=131072),
        # 稳定版本
        ModelInfo(id="qwen-max", name="Qwen-Max", provider="qwen", max_tokens=8192),
        ModelInfo(id="qwen-plus", name="Qwen-Plus", provider="qwen", max_tokens=131072),
        ModelInfo(id="qwen-turbo", name="Qwen-Turbo", provider="qwen", max_tokens=131072),
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
            # 发送一个简单的消息测试连接
            response = await self.client.chat.completions.create(
                model="qwen-turbo",
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=10
            )
            return True
        except Exception as e:
            self._handle_error(e)
    
    def list_models(self) -> List[ModelInfo]:
        """返回支持的模型列表"""
        return self.SUPPORTED_MODELS
    
    def _handle_error(self, e: Exception):
        """统一处理异常"""
        error_msg = str(e)
        if "401" in error_msg or "invalid_api_key" in error_msg.lower() or "InvalidApiKey" in error_msg:
            raise AuthenticationError("API Key无效或已过期")
        elif "429" in error_msg or "rate_limit" in error_msg.lower() or "Throttling" in error_msg:
            raise RateLimitError("请求频率超限，请稍后重试")
        elif "connection" in error_msg.lower() or "network" in error_msg.lower():
            raise NetworkError(f"网络连接失败: {error_msg}")
        else:
            raise ProviderError(f"通义千问 API错误: {error_msg}")
