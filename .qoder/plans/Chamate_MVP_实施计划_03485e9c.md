# Chamate MVP 实施计划

## 技术选型

| 层面 | 选型 | 理由 |
|------|------|------|
| 前端 | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | 现代React全栈框架，shadcn/ui快速构建高质量UI |
| 后端 | FastAPI + SQLAlchemy + Alembic | Python异步框架，AI生态友好，ORM + 数据迁移 |
| 数据库 | SQLite | MVP零依赖，后续可迁移至PostgreSQL |
| API Key存储 | 前端IndexedDB加密存储 | 密钥不经过后端，安全性更高 |
| AI流式 | SSE (Server-Sent Events) | 比WebSocket更简单，适合单向流式场景 |
| 部署 | Docker Compose | 前后端一键启动 |

## MVP功能范围

**包含（P0）：**
- 多模型对话（OpenAI / Claude / 通义千问 / 智谱AI）+ 流式响应
- 会话管理（创建/列表/删除/历史）
- API Key管理（配置/测试/加密存储）
- 基础辩论模式（单AI正反方论点生成 + 总结）
- 响应式UI布局

**不包含（后续版本）：**
- 记忆系统、MCP工具、RAG检索、头脑风暴、多角色协作、Harness编排

## 项目结构

```
chamate/
├── frontend/                 # Next.js 前端
│   ├── src/
│   │   ├── app/              # 页面路由
│   │   │   ├── page.tsx          # 主对话页
│   │   │   ├── debate/           # 辩论模式页
│   │   │   └── settings/         # 设置页
│   │   ├── components/       # UI组件
│   │   │   ├── chat/             # 对话相关组件
│   │   │   ├── debate/           # 辩论相关组件
│   │   │   ├── layout/           # 布局组件
│   │   │   └── ui/               # shadcn/ui基础组件
│   │   ├── lib/              # 工具函数
│   │   │   ├── api.ts            # 后端API客户端
│   │   │   ├── crypto.ts         # API Key加密
│   │   │   └── indexeddb.ts      # IndexedDB操作
│   │   └── stores/           # Zustand状态管理
│   ├── package.json
│   └── Dockerfile
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── api/              # API路由
│   │   │   ├── chat.py           # 对话接口
│   │   │   ├── conversation.py   # 会话管理
│   │   │   ├── debate.py         # 辩论接口
│   │   │   └── models.py         # 模型列表接口
│   │   ├── core/             # 核心配置
│   │   ├── db/               # 数据库模型与迁移
│   │   ├── providers/        # AI提供商适配器
│   │   │   ├── base.py           # 抽象基类
│   │   │   ├── openai.py
│   │   │   ├── anthropic.py
│   │   │   ├── qwen.py
│   │   │   └── zhipu.py
│   │   ├── schemas/          # Pydantic数据模型
│   │   └── services/         # 业务逻辑
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── docs/
    ├── 技术方案/
    │   ├── 技术可行性分析.md
    │   └── 技术架构设计.md
    └── 产品使用说明.md
```

## 实施任务

### Task 1: 技术调研与文档输出
- 编写 `docs/技术方案/技术可行性分析.md`：技术选型分析、各AI提供商API对比、关键技术风险评估
- 编写 `docs/技术方案/技术架构设计.md`：系统架构图、模块划分、数据模型设计、API接口设计
- 产出：两份文档落地到docs目录

### Task 2: 后端基础搭建
- FastAPI项目初始化、目录结构、依赖管理
- SQLAlchemy模型定义（Conversation、Message表）
- SQLite数据库配置与初始化
- 基础CORS、错误处理中间件
- 产出：可启动的后端骨架，数据库自动建表

### Task 3: AI提供商适配层
- 抽象Provider基类（统一接口：chat/stream_chat/test_connection）
- 实现4个Provider：OpenAI、Anthropic、通义千问、智谱AI
- 统一的流式响应处理（SSE格式输出）
- 模型列表查询接口
- 产出：所有Provider可独立测试，支持流式输出
- 依赖：Task 2

### Task 4: 后端业务API
- 会话CRUD接口（创建/列表/详情/删除/重命名）
- 对话接口（发送消息 + SSE流式响应）
- 辩论接口（创建辩论/执行回合/生成总结）
- 产出：完整REST API，可通过curl/Postman测试
- 依赖：Task 2, Task 3

### Task 5: 前端基础搭建
- Next.js项目初始化、Tailwind CSS + shadcn/ui配置
- 主布局框架（侧边栏 + 主内容区 + 顶部导航）
- API客户端封装（fetch + SSE流处理）
- IndexedDB + 加密工具（API Key安全存储）
- Zustand状态管理基础store
- 产出：可运行的前端骨架，布局完整

### Task 6: 前端对话功能
- 会话列表组件（创建/切换/删除/重命名）
- 消息展示组件（Markdown渲染、代码高亮、流式打字效果）
- 消息输入组件（文本框、模型选择器、发送按钮）
- 对接后端对话API + SSE流式接收
- 产出：完整的对话功能可用
- 依赖：Task 4, Task 5

### Task 7: 前端设置与辩论
- 设置页面：API Key管理（增删改、连接测试、加密存储）、模型配置
- 辩论页面：观点输入、正反方论点展示、多轮辩论交互、辩论总结
- 产出：设置和辩论功能完整可用
- 依赖：Task 4, Task 5

### Task 8: 部署与文档
- 编写前后端Dockerfile
- docker-compose.yml编排（前端 + 后端）
- 编写 `docs/产品使用说明.md`：安装部署、功能使用、API Key配置指南
- 验证Docker Compose一键启动
- 产出：可一键部署运行的完整MVP
- 依赖：Task 6, Task 7

## 任务依赖图

```
Task 1 (文档) ──────────────────────────────────────────→ 独立执行
Task 2 (后端基础) ──→ Task 3 (AI适配) ──→ Task 4 (API) ──→ Task 6 (前端对话) ──→ Task 8 (部署)
                                                        ──→ Task 7 (设置+辩论) ──→ Task 8
Task 5 (前端基础) ──────────────────────────────────────→ Task 6, Task 7
```

**可并行执行**：Task 1 与 Task 2/5 可同时启动；Task 6 与 Task 7 可同时启动。
