from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Optional
from dataclasses import dataclass


@dataclass
class ModelInfo:
    """模型信息"""
    id: str
    name: str
    provider: str
    max_tokens: int = 4096


class BaseProvider(ABC):
    """AI提供商抽象基类"""
    
    provider_name: str = ""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url
    
    @abstractmethod
    async def chat(self, messages: List[dict], model: str, **kwargs) -> str:
        """同步对话，返回完整回复"""
        pass
    
    @abstractmethod
    async def stream_chat(self, messages: List[dict], model: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式对话，yield每个token"""
        pass
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """测试API连接是否正常"""
        pass
    
    @abstractmethod
    def list_models(self) -> List[ModelInfo]:
        """返回支持的模型列表"""
        pass


class ProviderError(Exception):
    """Provider错误基类"""
    pass


class AuthenticationError(ProviderError):
    """认证错误"""
    pass


class RateLimitError(ProviderError):
    """速率限制错误"""
    pass


class NetworkError(ProviderError):
    """网络错误"""
    pass
