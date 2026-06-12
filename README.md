# MusesAOS - AI Agent 多模态创作平台

**面向 AI 原生内容生产的可视化 Agent 工作流平台**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=111)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Database-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![E2B](https://img.shields.io/badge/E2B-Agent%20Sandbox-111827?style=flat)](https://e2b.dev)

[项目简介](#项目简介) • [功能特性](#功能特性) • [快速开始](#快速开始) • [部署指南](#部署指南) • [关于作者](#关于作者) • [交流群](#交流群)

---

## 项目简介

MusesAOS 是一个 AI Agent 多模态创作平台，核心目标是把“单次生成工具”升级为“可复用的 AI 内容生产工作流”。用户可以在可视化画布中组合文本、图像、视频、语音、音乐和 Agent 执行节点，将创意生产过程沉淀为项目、流程和资产。

![MusesAOS 首页截图](public/screenshots/缪斯系统首页.png)

它不是简单聚合多个模型入口，而是围绕 **工作流、Agent、沙箱、资产和项目管理** 构建一个 AI 原生创作系统：

- 从 prompt 到多模态内容生成
- 从单次生成到可保存的创作流程
- 从聊天助手到可执行任务的 Agent
- 从临时结果到项目资产和交付产物

> MusesAOS 的长期愿景是成为 AI 内容生产时代的创作操作系统。

## 核心价值

- **工作流驱动**：用可视化画布组织创作链路，让好用的创作方法可以复用和沉淀。
- **多模态统一**：文本、图像、视频、语音、音乐在同一系统中统一调用、管理和保存。
- **Agent 执行闭环**：Agent 不只回答问题，还可以启动沙箱、执行命令、生成文件并回传结果。
- **产品化基础完整**：登录、项目、积分、资产、限流、鉴权、日志脱敏等商业化基础已具备。
- **可扩展模型架构**：模型目录集中配置，服务端统一代理，便于扩展新模型和切换供应商。

## 典型使用场景

| 场景 | 说明 |
| --- | --- |
| AI 内容工作室 | 批量生成脚本、视觉、视频、配音和音乐素材 |
| 短视频/营销团队 | 将选题、分镜、素材生成和成片准备组织成可复用流程 |
| AI 产品原型团队 | 快速验证多模型组合、Agent 工作流和沙箱执行能力 |
| 创作者个人工作台 | 管理项目、资产和生成历史，减少跨工具复制粘贴 |
| 企业内部自动化 | 通过 Agent + 沙箱执行，把内容生产和自动化任务连接起来 |

---

## 功能特性

### 可视化工作流画布

- ✅ 基于节点的多模态创作画布
- ✅ 文本输入、图片输入、多模态统一生成节点
- ✅ 项目创建、保存、加载、重命名和删除
- ✅ 画布状态持久化，支持持续迭代创作流程
- ✅ Space 视图和 3D 视觉展示

### 多模态生成

- ✅ 文本生成：长文案、脚本、创意描述、内容改写
- ✅ 图像生成：文生图、参考图编辑、多模型切换
- ✅ 视频生成：图生视频、文生视频、时长参数适配
- ✅ 语音生成：文本转语音
- ✅ 音乐生成：音乐创作与结果管理
- ✅ 生成结果统一上传和回传

### AI Agent

- ✅ 流式对话体验
- ✅ Agent runtime session 复用
- ✅ 工具执行事件追踪
- ✅ 上下文重置
- ✅ 沙箱启动状态展示
- ✅ 沙箱文件浏览和下载

### E2B 沙箱执行

- ✅ Node.js 22+ 沙箱环境
- ✅ Agent 可执行命令、读写文件、生成产物
- ✅ 内置 Skills 同步
- ✅ 沙箱路径安全校验
- ✅ 敏感文件过滤
- ✅ Runtime 异步清理，降低资源泄漏风险

### 账户、积分与安全

- ✅ Supabase 登录认证
- ✅ 邀请码有效期校验
- ✅ 积分预扣、确认、失败回滚
- ✅ 服务端 API Key 隔离
- ✅ API 输入校验
- ✅ 关键接口限流
- ✅ 错误信息和模型响应日志脱敏

---

## 支持模型

模型目录集中维护在 `lib/modelCatalog.ts`。

| 类型 | 当前支持 |
| --- | --- |
| 文本 | GPT-5 Mini、DeepSeek V4 Flash、DeepSeek V4 Pro、Kimi K2.5、Doubao Seed 1.8 |
| 图像 | Doubao Seedream 5.0 Lite、Gemini 3 Pro Image、Gemini 2.5 Flash Image、GPT Image 2 |
| 视频 | Kling、Doubao、Seedance 2.0、HappyHorse 1.0 |
| 语音 | Speech 2.6 HD |
| 音乐 | Suno V5 |
| Agent | DeepSeek V4 Flash、DeepSeek V4 Pro、GPT-4o |

---

## 技术架构

```text
app/                    Next.js App Router 页面和 API 路由
components/             画布、节点、Agent 面板、沙箱文件面板
lib/agents/             Agent runtime、MCP、E2B sandbox、Skills
lib/credits.ts          积分计费、鉴权、预扣和回滚
lib/modelCatalog.ts     多模态模型目录
services/               浏览器端 API service
stores/                 Zustand 状态管理
supabase/               数据表和积分 SQL
public/                 静态资源、截图、交流群二维码
```

### 核心技术栈

| 模块 | 技术 |
| --- | --- |
| 前端框架 | Next.js 15 + React 18 |
| 开发语言 | TypeScript strict mode |
| 样式系统 | Tailwind CSS |
| 工作流画布 | React Flow / @xyflow/react |
| 状态管理 | Zustand |
| 数据与认证 | Supabase |
| 文件资产 | Cloudflare R2 / 服务端上传 |
| Agent 执行 | Pi Coding Agent + MCP Adapter + E2B Sandbox |
| 视觉渲染 | OGL / Three.js |
| 输入校验 | Zod |
| 测试 | Jest + Testing Library |

---

## 产品进展

| 时间 | 进展 |
| --- | --- |
| 2026-05-01 | MusesSystem 0.01 启动，完成画布和多模态工作流基础 |
| 2026-05-03 | 上线时间线页面，接入 HappyHorse 视频模型，切换 Agent 助手 |
| 2026-05-13 | 完善积分计费和资产上传链路 |
| 2026-05-20 | 完成 Agent 架构升级，接入 E2B 沙箱、MCP 适配器、官方 Skills 和 Model Router |
| 2026-05-27 | 上线沙箱文件浏览与下载能力，Agent 生成产物可直接取回 |
| 2026-05-28 | 完成 Runtime 清理、邀请码鉴权、沙箱限流、日志脱敏和前端稳定性修复 |

更多阶段可查看应用内 `/timeline` 页面。

---

## 快速开始

### 环境要求

| 软件 | 版本 |
| --- | --- |
| Node.js | 建议 20+ |
| npm | 建议 9+ |
| Supabase | 需要项目 URL、Anon Key、Service Role Key |
| E2B | 如需 Agent 沙箱执行，需要 E2B API Key |

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env.local
```

关键配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DMX_API_KEY=

R2_ACCOUNT_ID=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=

DeepSeek_API_KEY=
MUSES_AGENT_MODEL=deepseek:deepseek-v4-flash

E2B_API_KEY=
AGENT_SANDBOX_PROVIDER=e2b
E2B_SANDBOX_TEMPLATE=muses-node22
```

> 说明：E2B 沙箱在当前产品设计中默认保持联网能力，用于 Agent 执行真实任务和安装依赖。

### 启动项目

```bash
npm run dev
```

访问：

```text
http://localhost:3000
```

如果 3000 端口被占用，Next.js 会自动切换到 3001、3002 等可用端口。

### 常用检查命令

```bash
npm run type-check
npm run lint
npm test
```

最近一次完整验证结果：

```text
31 个测试套件通过
136 个测试通过
```

---

## 部署指南

### Vercel / Node 服务部署

1. 配置 `.env.local` 中对应的生产环境变量。
2. 确认 Supabase、R2、DMX、DeepSeek、E2B 等服务可用。
3. 构建项目：

```bash
npm run build
```

4. 启动生产服务：

```bash
npm start
```

### 部署注意事项

- Supabase Service Role Key 只能放在服务端环境变量中。
- 生成资产必须使用公网可访问的 R2 域名，否则外部模型服务可能无法读取参考图。
- E2B 沙箱有成本，生产环境建议增加用量监控和告警。
- 邀请码、沙箱文件、Agent stream 等接口已经加入鉴权或限流，部署时仍建议配合平台级 WAF / Rate Limit。

---

## 常见问题

### Q: MusesAOS 和普通 AI 绘图/视频工具有什么区别？

A: 普通工具通常解决单次生成。MusesAOS 更关注创作流程，把多个模型、输入节点、生成节点、Agent 执行和项目资产组织成可复用工作流。

### Q: 为什么需要 Agent 沙箱？

A: 真实生产任务往往不止是生成一段文字，还需要执行命令、处理文件、生成项目产物。沙箱让 Agent 可以在隔离环境中完成这些操作，并把结果带回产品界面。


### Q: 可以接入更多模型吗？

A: 可以。模型目录集中在 `lib/modelCatalog.ts`，生成能力通过服务端 API 封装，新增模型或切换供应商不需要重写画布交互。

---

## 下一阶段 Roadmap

- [ ] 工作流模板市场：沉淀可复用创作流程
- [ ] 团队空间：成员、权限、项目协作
- [ ] 资产库：统一管理图片、视频、音频、项目产物
- [ ] 商业化计费：订阅、积分包、用量看板
- [ ] Agent 面板拆分和长任务体验增强
- [ ] MCP server 配置化和企业私有模型接入
- [ ] 生产 CSP、安全监控和成本告警

---

## 关于作者

**Jason Huang**

AI 产品与工程实践者，长期关注 Agent、AI 工作流、多模态内容生产和个人/团队生产力工具。

- GitHub: [HeteroCat](https://github.com/HeteroCat/musesAOS)
- 项目状态: 持续迭代中
- 当前方向: AI Agent 创作平台、可视化工作流、多模态agent生成系统

---

## 交流群

欢迎扫码加入内测与体验社群，反馈问题、体验新功能、交流 AI 产品和 Agent 工作流。

<table>
  <tr>
    <td align="center" width="33%">
      <strong>作者微信</strong><br />
      <sub>添加 Jason，交流合作与产品反馈</sub><br /><br />
      <img src="public/img/wx-image.png" width="220" alt="Jason Huang 微信二维码" />
    </td>
    <td align="center" width="33%">
      <strong>飞书内测群</strong><br />
      <sub>加入 MusesAOS 飞书内测群</sub><br /><br />
      <img src="public/img/feishu.png" width="220" alt="MusesAOS 飞书内测群二维码" />
    </td>
    <td align="center" width="33%">
      <strong>微信体验群</strong><br />
      <sub>加入微信体验群，获取最新体验入口</sub><br /><br />
      <img src="public/img/wxgroup-image.png" width="220" alt="MusesAOS 微信体验群二维码" />
    </td>
  </tr>
</table>

---

## 贡献与反馈

欢迎通过 Issue、Pull Request 或社群反馈问题与建议。

如果你正在关注 AI Agent、内容生产工作流、多模态创作平台，欢迎一起交流。

**如果这个项目对你有帮助，欢迎 Star。**

Made with care by Jason Huang.

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.
