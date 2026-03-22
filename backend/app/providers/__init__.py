from typing import Optional, List, Dict, Any

from .base import BaseProvider, ModelInfo, ProviderError, AuthenticationError, RateLimitError, NetworkError
from .openai import OpenAIProvider
from .anthropic import AnthropicProvider
from .qwen import QwenProvider
from .zhipu import ZhipuProvider

# 注册所有Provider
PROVIDERS: Dict[str, type] = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "qwen": QwenProvider,
    "zhipu": ZhipuProvider,
}


def get_provider(provider_name: str, api_key: str, base_url: Optional[str] = None) -> BaseProvider:
    """根据名称获取Provider实例"""
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown provider: {provider_name}. Supported providers: {list(PROVIDERS.keys())}")
    return provider_class(api_key=api_key, base_url=base_url)


def list_all_providers() -> List[Dict[str, Any]]:
    """列出所有支持的提供商及其模型"""
    result = []
    for name, cls in PROVIDERS.items():
        # 使用空key创建临时实例仅为获取模型列表
        # 需要跳过初始化中的API客户端创建
        try:
            instance = cls(api_key="dummy_key_for_listing")
            models = instance.list_models()
        except Exception:
            # 如果创建失败，直接从类属性获取模型列表
            models = getattr(cls, 'SUPPORTED_MODELS', [])
        
        result.append({
            "provider": name,
            "models": [
                {"id": m.id, "name": m.name, "max_tokens": m.max_tokens} 
                for m in models
            ]
        })
    return result


__all__ = [
    "BaseProvider",
    "ModelInfo",
    "ProviderError",
    "AuthenticationError",
    "RateLimitError",
    "NetworkError",
    "OpenAIProvider",
    "AnthropicProvider",
    "QwenProvider",
    "ZhipuProvider",
    "PROVIDERS",
    "get_provider",
    "list_all_providers",
]
