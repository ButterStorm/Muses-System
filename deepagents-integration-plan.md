# MusesAOS + DeepAgents Deploy 集成方案

## 方案概述

由于 `deepagents deploy` CLI 是配置驱动的部署工具（基于 Python/uv），而你的项目是 TypeScript/Node.js 技术栈，推荐采用 **"独立部署 + API 集成"** 的架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                     MusesAOS (Next.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  AgentPanel  │  │   流程图画布  │  │    多模态生成节点     │   │
│  │   (UI更新)    │  │              │  │                      │   │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘   │
│         │                                                       │
│         │  HTTP/WebSocket                                        │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              /api/agent/proxy  (API路由)                  │   │
│  │    - 转发请求到 DeepAgents Deployment                     │   │
│  │    - 处理认证和会话管理                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP (MCP/Agent Protocol)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              DeepAgents Deployment (LangSmith)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  - deepagents.toml 配置                                   │   │
│  │  - AGENTS.md (Muses 专属系统提示)                          │   │
│  │  - skills/ (流程图操作、节点生成等技能)                     │   │
│  │  - 独立沙箱执行环境                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 实施步骤

### 步骤 1: 创建 DeepAgents 配置目录

在项目根目录创建 `agent-deployment/` 文件夹：

```
musesAOS/
├── app/                    # 原有 Next.js 应用
├── components/
├── agent-deployment/       # 新增：DeepAgents 配置
│   ├── deepagents.toml
│   ├── AGENTS.md
│   ├── .env
│   └── skills/
│       ├── workflow-builder/
│       │   └── SKILL.md
│       ├── node-generator/
│       │   └── SKILL.md
│       └── content-creator/
│           └── SKILL.md
└── ...
```

### 步骤 2: 配置 DeepAgents

#### `agent-deployment/deepagents.toml`

```toml
[agent]
name = "muses-aos-agent"
model = "anthropic:claude-sonnet-4-6"

[sandbox]
provider = "daytona"  # 或 "modal", "runloop"
template = "node-18"
image = "node:18-alpine"
scope = "thread"
```

#### `agent-deployment/AGENTS.md`

```markdown
# MusesAOS AI Agent

你是 MusesAOS 的智能助手，一个 AI 驱动的多模态创作平台。

## 核心能力

### 1. 流程图构建
- 帮助用户设计和构建创作流程图
- 理解节点之间的数据流关系
- 推荐最佳节点组合

### 2. 节点生成
- 根据用户需求生成文本生成节点
- 创建图像生成工作流
- 构建视频、音频、音乐生成管道

### 3. 内容创作
- 协助编写提示词（prompts）
- 优化生成参数
- 提供创作建议

## 可用节点类型

| 节点类型 | 功能 |
|---------|------|
| TextGeneration | 文本生成（GPT、DeepSeek、Kimi等） |
| ImageGeneration | 图像生成 |
| VideoGeneration | 视频生成 |
| AudioGeneration | 音频生成 |
| MusicGeneration | 音乐生成 |
| Input | 用户输入 |
| Output | 输出节点 |
| Condition | 条件分支 |

## 工作流

1. **理解需求** → 询问用户创作目标
2. **设计方案** → 推荐流程图结构
3. **生成配置** → 输出节点配置 JSON
4. **优化迭代** → 根据反馈调整

## 响应格式

当生成流程图配置时，使用以下 JSON 格式：

```json
{
  "nodes": [
    {
      "id": "text-gen-1",
      "type": "TextGeneration",
      "position": { "x": 100, "y": 100 },
      "data": {
        "model": "gpt-4",
        "prompt": "...",
        "temperature": 0.7
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "input-1",
      "target": "text-gen-1"
    }
  ]
}
```
```

### 步骤 3: 定义 Skills

#### `skills/workflow-builder/SKILL.md`

```markdown
---
name: workflow-builder
description: 构建和优化多模态创作流程图
---

# Workflow Builder Skill

帮助用户设计和构建复杂的 AI 创作流程图。

## 场景

### 场景 1: 社交媒体内容创作
输入：主题 → 文本生成 → 图像生成 → 输出

### 场景 2: 视频脚本创作
输入：主题 → 脚本生成 → 分镜描述 → 视频生成 → 配音生成 → 合并输出

### 场景 3: 音乐专辑封面
输入：专辑概念 → 风格描述生成 → 封面图像生成 → 变体生成

## 节点连接规则

- Input 节点必须是起点
- Output 节点必须是终点
- 条件节点可以有多个输出
- 循环连接需要用户确认
```

#### `skills/node-generator/SKILL.md`

```markdown
---
name: node-generator
description: 生成具体节点配置
---

# Node Generator Skill

根据用户需求生成标准化的节点配置。

## 支持的模型

### 文本生成
- gpt-4, gpt-4o, gpt-3.5-turbo
- deepseek-chat, deepseek-coder
- kimi-k2, kimi-k1.5
- gemini-pro, gemini-ultra
- doubao-pro, doubao-lite

### 图像生成
- dall-e-3
- stable-diffusion-xl
- midjourney-style (via API)

### 参数建议

```json
{
  "creative": {
    "temperature": 0.9,
    "top_p": 0.95
  },
  "balanced": {
    "temperature": 0.7,
    "top_p": 0.9
  },
  "precise": {
    "temperature": 0.3,
    "top_p": 0.85
  }
}
```
```

### 步骤 4: 部署 DeepAgents

```bash
# 进入配置目录
cd agent-deployment

# 安装 CLI（如果还没有）
uv tool install deepagents-cli

# 或者使用 uvx（无需安装）
# uvx deepagents-cli deploy

# 本地测试
deepagents dev --port 2024

# 部署到生产
deepagents deploy
```

部署后会获得一个 LangSmith Deployment URL，类似：
`https://smith.langchain.com/o/{org}/deployments/{deployment-id}`

---

## 步骤 5: 更新 MusesAOS 前端

### 5.1 创建 API 代理路由

#### `app/api/agent/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const DEEPAGENTS_ENDPOINT = process.env.DEEPAGENTS_ENDPOINT!;
const DEEPAGENTS_API_KEY = process.env.DEEPAGENTS_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, threadId } = await req.json();

    // 调用 DeepAgents Deployment
    const response = await fetch(`${DEEPAGENTS_ENDPOINT}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPAGENTS_API_KEY}`,
      },
      body: JSON.stringify({
        assistant_id: 'muses-aos-agent',
        thread_id: threadId,
        input: {
          messages: [
            { role: 'user', content: message }
          ]
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepAgents error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      message: data.output?.messages?.slice(-1)?.[0]?.content || '无响应',
      threadId: data.thread_id,
      sessionId: data.session_id,
    });

  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Agent 服务暂时不可用' },
      { status: 500 }
    );
  }
}
```

#### `app/api/agent/stream/route.ts` (流式响应)

```typescript
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { message, threadId } = await req.json();

  const response = await fetch(`${process.env.DEEPAGENTS_ENDPOINT}/runs/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPAGENTS_API_KEY}`,
    },
    body: JSON.stringify({
      assistant_id: 'muses-aos-agent',
      thread_id: threadId,
      input: { messages: [{ role: 'user', content: message }] },
      stream_mode: ['messages'],
    }),
  });

  // 转换为 ReadableStream 返回给客户端
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 5.2 更新 AgentPanel 组件

#### `components/AgentPanel.tsx`

```typescript
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSessionStore } from '@/stores/sessionStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const AgentPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 MusesAOS AI 助手。我可以帮你：\n\n• 设计创作流程图\n• 生成节点配置\n• 优化提示词\n• 解答使用问题\n\n有什么可以帮你的吗？',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          threadId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setThreadId(data.threadId);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // 如果响应包含流程图配置，触发事件让画布处理
      try {
        const jsonMatch = data.message.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const workflowConfig = JSON.parse(jsonMatch[1]);
          window.dispatchEvent(new CustomEvent('agent:workflow-generated', {
            detail: workflowConfig,
          }));
        }
      } catch {
        // 不是 JSON，忽略
      }

    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '抱歉，服务暂时不可用，请稍后重试。',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 触发按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 pl-4 rounded-l-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={20} />
            <span className="font-medium">AI 助手</span>
          </div>
        </button>
      )}

      {/* 侧边面板 */}
      <div
        className={`fixed right-0 top-0 h-full bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col border-l border-gray-200 z-50`}
        style={{
          width: isOpen ? '400px' : '0px',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center gap-2">
            <Bot size={24} />
            <span className="font-semibold">Muses AI 助手</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown className="prose prose-sm max-w-none">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm text-gray-500">思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="输入消息..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AgentPanel;
```

### 5.3 创建会话状态管理

#### `stores/sessionStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      threadId: null,
      setThreadId: (id) => set({ threadId: id }),
      clearSession: () => set({ threadId: null }),
    }),
    {
      name: 'agent-session',
    }
  )
);
```

### 5.4 在画布监听 Agent 生成的工作流

#### `components/FlowCanvas.tsx` (添加监听)

```typescript
useEffect(() => {
  const handleWorkflowGenerated = (event: CustomEvent) => {
    const workflowConfig = event.detail;

    // 将生成的节点添加到画布
    const newNodes = workflowConfig.nodes.map((node: any) => ({
      ...node,
      id: `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    const newEdges = workflowConfig.edges.map((edge: any) => ({
      ...edge,
      id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    setNodes((nds) => [...nds, ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);

    // 提示用户
    toast.success('AI 已生成工作流节点');
  };

  window.addEventListener('agent:workflow-generated', handleWorkflowGenerated as EventListener);

  return () => {
    window.removeEventListener('agent:workflow-generated', handleWorkflowGenerated as EventListener);
  };
}, [setNodes, setEdges]);
```

---

## 环境变量配置

#### `.env.local` (新增)

```bash
# DeepAgents Deployment 配置
DEEPAGENTS_ENDPOINT=https://api.smith.langchain.com/o/your-org/deployments/your-deployment
DEEPAGENTS_API_KEY=lsv2_your_key_here
```

---

## 快速启动脚本

#### `scripts/deploy-agent.sh`

```bash
#!/bin/bash

cd agent-deployment

echo "🚀 部署 MusesAOS AI Agent..."

# 检查 uv 是否安装
if ! command -v uv &> /dev/null; then
    echo "❌ 需要安装 uv"
    echo "运行: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# 本地开发模式
if [ "$1" == "dev" ]; then
    echo "🧪 启动本地开发服务器..."
    uvx deepagents-cli dev --port 2024
else
    # 生产部署
    echo "📦 部署到生产环境..."
    uvx deepagents-cli deploy
fi
```

---

## 方案优势

| 优势 | 说明 |
|-----|------|
| **技术栈独立** | DeepAgents 部署与 Next.js 应用解耦，互不影响 |
| **可扩展** | 可以随时扩展 Agent 能力，无需修改前端代码 |
| **沙箱安全** | 代码执行在隔离沙箱中，保护主应用安全 |
| **多模型支持** | 可以轻松切换不同 LLM 提供商 |
| **技能复用** | 技能可以被多个项目复用 |
| **标准协议** | 使用 Agent Protocol，易于集成其他工具 |

---

## 备选方案对比

| 方案 | 适用场景 | 复杂度 |
|-----|---------|-------|
| **推荐: 独立部署** | 生产环境，需要完整功能 | 中 |
| 直接集成 langchain.js | 简单对话，不需要沙箱 | 低 |
| 使用 deepagents.js | 纯 JS 环境，需要自建部署 | 高 |

对于 MusesAOS，推荐采用 **独立部署方案**，因为它能充分利用 DeepAgents 的全部功能（沙箱、技能、子智能体），同时保持现有 Next.js 架构不变。
