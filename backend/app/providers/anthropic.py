from typing import AsyncGenerator, List, Optional
from anthropic import AsyncAnthropic
import httpx

from .base import (
    BaseProvider, ModelInfo,
    ProviderError, AuthenticationError, RateLimitError, NetworkError
)


class AnthropicProvider(BaseProvider):
    """Anthropic Provider实现"""
    
    provider_name: str = "anthropic"
    
    SUPPORTED_MODELS = [
        ModelInfo(id="claude-sonnet-4-20250514", name="Claude Sonnet 4", provider="anthropic", max_tokens=8192),
        ModelInfo(id="claude-3-5-sonnet-20241022", name="Claude 3.5 Sonnet", provider="anthropic", max_tokens=8192),
        ModelInfo(id="claude-3-haiku-20240307", name="Claude 3 Haiku", provider="anthropic", max_tokens=4096),
    ]
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        super().__init__(api_key, base_url)
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = AsyncAnthropic(**kwargs)
    
    def _convert_messages(self, messages: List[dict]) -> tuple[Optional[str], List[dict]]:
        """
        将OpenAI格式的消息转换为Anthropic格式
        Anthropic的system消息需要单独传递，不在messages列表中
        """
        system_prompt = None
        converted_messages = []
        
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            
            if role == "system":
                system_prompt = content
            elif role in ["user", "assistant"]:
                converted_messages.append({
                    "role": role,
                    "content": content
                })
        
        return system_prompt, converted_messages
    
    async def chat(self, messages: List[dict], model: str, **kwargs) -> str:
        """同步对话，返回完整回复"""
        try:
            system_prompt, converted_messages = self._convert_messages(messages)
            
            request_kwargs = {
                "model": model,
                "messages": converted_messages,
                "max_tokens": kwargs.pop("max_tokens", 4096),
            }
            
            if system_prompt:
                request_kwargs["system"] = system_prompt
            
            request_kwargs.update(kwargs)
            
            response = await self.client.messages.create(**request_kwargs)
            
            # Anthropic返回的content是一个列表
            if response.content and len(response.content) > 0:
                return response.content[0].text
            return ""
        except httpx.ConnectError as e:
            raise NetworkError(f"网络连接失败: {str(e)}")
        except Exception as e:
            self._handle_error(e)
    
    async def stream_chat(self, messages: List[dict], model: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式对话，yield每个token"""
        try:
            system_prompt, converted_messages = self._convert_messages(messages)
            
            request_kwargs = {
                "model": model,
                "messages": converted_messages,
                "max_tokens": kwargs.pop("max_tokens", 4096),
            }
            
            if system_prompt:
                request_kwargs["system"] = system_prompt
            
            request_kwargs.update(kwargs)
            
            async with self.client.messages.stream(**request_kwargs) as stream:
                async for text in stream.text_stream:
                    yield text
        except httpx.ConnectError as e:
            raise NetworkError(f"网络连接失败: {str(e)}")
        except Exception as e:
            self._handle_error(e)
    
    async def test_connection(self) -> bool:
        """测试API连接是否正常"""
        try:
            # 发送一个简单的消息测试连接
            response = await self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
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
        if "401" in error_msg or "invalid_api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            raise AuthenticationError("API Key无效或已过期")
        elif "429" in error_msg or "rate_limit" in error_msg.lower():
            raise RateLimitError("请求频率超限，请稍后重试")
        elif "connection" in error_msg.lower() or "network" in error_msg.lower():
            raise NetworkError(f"网络连接失败: {error_msg}")
        else:
            raise ProviderError(f"Anthropic API错误: {error_msg}")
