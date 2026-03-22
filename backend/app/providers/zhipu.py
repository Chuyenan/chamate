from typing import AsyncGenerator, List, Optional
import httpx

from .base import (
    BaseProvider, ModelInfo,
    ProviderError, AuthenticationError, RateLimitError, NetworkError
)


class ZhipuProvider(BaseProvider):
    """智谱AI Provider实现"""
    
    provider_name: str = "zhipu"
    
    SUPPORTED_MODELS = [
        ModelInfo(id="glm-4-plus", name="GLM-4 Plus", provider="zhipu", max_tokens=128000),
        ModelInfo(id="glm-4", name="GLM-4", provider="zhipu", max_tokens=128000),
        ModelInfo(id="glm-4-flash", name="GLM-4 Flash", provider="zhipu", max_tokens=128000),
    ]
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        super().__init__(api_key, base_url)
        # 延迟导入，避免未安装时报错
        from zhipuai import ZhipuAI
        self.client = ZhipuAI(api_key=api_key)
    
    async def chat(self, messages: List[dict], model: str, **kwargs) -> str:
        """同步对话，返回完整回复"""
        try:
            # zhipuai库是同步的，需要在异步环境中调用
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    **kwargs
                )
            )
            return response.choices[0].message.content or ""
        except httpx.ConnectError as e:
            raise NetworkError(f"网络连接失败: {str(e)}")
        except Exception as e:
            self._handle_error(e)
    
    async def stream_chat(self, messages: List[dict], model: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式对话，yield每个token"""
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            
            # 创建流式响应
            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    stream=True,
                    **kwargs
                )
            )
            
            # 遍历流式响应
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except httpx.ConnectError as e:
            raise NetworkError(f"网络连接失败: {str(e)}")
        except Exception as e:
            self._handle_error(e)
    
    async def test_connection(self) -> bool:
        """测试API连接是否正常"""
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(
                    model="glm-4-flash",
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=10
                )
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
        if "401" in error_msg or "invalid_api_key" in error_msg.lower() or "api_key" in error_msg.lower():
            raise AuthenticationError("API Key无效或已过期")
        elif "429" in error_msg or "rate_limit" in error_msg.lower():
            raise RateLimitError("请求频率超限，请稍后重试")
        elif "connection" in error_msg.lower() or "network" in error_msg.lower():
            raise NetworkError(f"网络连接失败: {error_msg}")
        else:
            raise ProviderError(f"智谱AI API错误: {error_msg}")
