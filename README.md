# Chamate

本地自托管的AI智能对话平台，支持多模型切换、辩论模式，API Key安全存储在本地。

## 核心亮点

- **多模型支持**：OpenAI、Claude、通义千问、智谱AI 一键切换
- **辩论模式**：AI正反方多轮辩论，帮助完善观点
- **隐私安全**：API Key 本地加密存储，数据不上传云端
- **流式响应**：实时输出，体验流畅
- **Docker部署**：一键启动，开箱即用

## 功能特性

- **多模型对话**：支持 4 大主流 AI 提供商，自由切换
- **辩论模式**：输入观点，AI 生成正反方论点并多轮辩论
- **API Key 管理**：AES-256 加密存储于浏览器本地
- **对话历史**：完整记录所有会话，支持搜索和管理
- **流式输出**：SSE 实时推送，逐字显示回复

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16, React 19, TailwindCSS, Zustand |
| 后端 | FastAPI, SQLAlchemy, Pydantic |
| 数据库 | SQLite (对话历史), IndexedDB (API Key) |
| 部署 | Docker Compose |

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 20+
- 至少一个 AI 提供商的 API Key

### 本地开发

**后端**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**前端**
```bash
cd frontend
npm install
npm run dev
```

**或使用一键启动（Windows）**
```bash
start.bat
```

### Docker 部署

```bash
docker-compose up -d
```

访问地址：
- 前端界面：http://localhost:3000
- API 服务：http://localhost:8000

## 项目结构

```
chamate/
├── backend/          # 后端服务 (FastAPI)
│   ├── app/
│   │   ├── api/      # API 路由
│   │   ├── providers/# AI 提供商适配
│   │   └── db/       # 数据库模型
│   └── requirements.txt
├── frontend/         # 前端应用 (Next.js)
│   ├── src/
│   │   ├── app/      # 页面路由
│   │   ├── components/# UI 组件
│   │   └── stores/   # 状态管理
│   └── package.json
├── docs/             # 项目文档
└── docker-compose.yml
```

## 支持的AI模型

| 提供商 | 主要模型 | 说明 |
|--------|----------|------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo | 通用能力强 |
| Anthropic | claude-sonnet-4, claude-3-5-sonnet | 长文本、代码能力强 |
| 通义千问 | qwen3.5-plus, qwen-max, qwen-plus | 中文场景优化 |
| 智谱AI | glm-4-plus, glm-4, glm-4-flash | 性价比高 |

**默认模型**：qwen3.5-plus

## 开发指南

| 服务 | 地址 |
|------|------|
| 后端 API 文档 | http://localhost:8000/docs |
| 前端开发服务 | http://localhost:3000 |

## License

MIT
