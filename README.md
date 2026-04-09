# Muses System

AI 驱动的多模态创作平台，基于流程图式交互设计，支持文本、图片、视频、音频、音乐等多种内容生成。

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript (strict mode) |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 数据库/后端 | Supabase |
| 流程图 | React Flow (@xyflow/react) |
| 3D 渲染 | Three.js + OGL |
| AI 服务 | DMX API (GPT, DeepSeek, Kimi, Gemini, 豆包等) |
| 输入验证 | Zod |

## 功能

- 多模态 AI 生成：文本、图片、视频、音频、音乐
- 流程图画布：拖拽式节点编辑
- 项目管理：创建、保存、加载、重命名
- AI Agent 对话助手
- 邀请码激活系统
- 暗黑模式
- 多语言支持（中英文）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```bash
cp .env.example .env.local
```

必须配置的变量：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（服务端专用） |
| `DMX_API_KEY` | DMX API 密钥（服务端专用） |

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
app/
  api/          # 服务端 API 路由（AI 生成、邀请码等）
  canvas/       # 画布页面
  login/        # 登录/注册页面
  projects/     # 项目管理页面
components/
  nodes/        # 流程图节点组件
  modals/       # 弹窗组件
  AgentPanel.tsx    # AI 助手面板
  FlowCanvas.tsx    # 流程图画布
  Galaxy.tsx        # 首页 3D 背景
  Toolbar.tsx       # 工具栏
  UserMenu.tsx      # 用户菜单
lib/
  supabase.ts       # Supabase 客户端
  serverStorage.ts  # 服务端文件上传
services/           # 前端 API 调用服务
stores/             # Zustand 状态管理
```

## 安全说明

- AI API Key 存储在服务端环境变量中，不暴露到浏览器
- 所有 API 路由使用 Zod 进行输入验证
- API 请求有频率限制（20 次/分钟/IP）
- 安全响应头（CSP、X-Frame-Options 等）已配置

## 许可

私有项目
