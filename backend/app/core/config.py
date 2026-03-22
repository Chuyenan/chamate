from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    """应用配置"""
    
    DATABASE_URL: str = "sqlite:///./chamate.db"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    API_PREFIX: str = "/api"
    
    # LLM API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    ZHIPUAI_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
        
    @classmethod
    def parse_env_var(cls, field_name: str, raw_val: str):
        if field_name == "CORS_ORIGINS":
            try:
                return json.loads(raw_val)
            except json.JSONDecodeError:
                return [raw_val]
        return raw_val


settings = Settings()
