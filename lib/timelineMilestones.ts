import { MODEL_CATALOG } from '@/lib/modelCatalog';

const modelGroupLabels = {
  text: '文本',
  image: '图像',
  video: '视频',
  audio: '语音',
  music: '音乐',
} as const;

const supportedModelGroups = Object.entries(MODEL_CATALOG).map(([type, models]) => ({
  label: modelGroupLabels[type as keyof typeof modelGroupLabels],
  models: models.map((model) => model.label),
}));

export const timelineMilestones = [
  {
    date: '2026 年 05 月 28 日',
    title: 'MusesAOS 紧急稳定性修复',
    description: '完成 Agent Runtime 异步清理、邀请码 check 鉴权与限流、沙箱文件 API 限流、ObjectURL 内存释放和 Gemini 日志脱敏；同时优化 Galaxy 隐藏态渲染、首次保存并发保护和首页产品定位。',
    yearClass: 'bg-[#fee2e2] text-[#5f1717]',
    markerClass: 'bg-[#ef4444] border-[#dc2626] text-[#fee2e2]',
    cardClass: 'hover:border-[#fca5a5] hover:shadow-[0_24px_60px_rgba(239,68,68,0.14)]',
  },
  {
    date: '2026 年 05 月 27 日',
    title: '沙箱文件管理上线',
    description: '新增沙箱文件浏览与下载能力，支持安全路径校验、敏感文件过滤、中文文件名下载和 AgentPanel 沙箱状态提示，让 Agent 生成的产物可以在画布中直接查看和取回。',
    yearClass: 'bg-[#ccfbf1] text-[#134e4a]',
    markerClass: 'bg-[#14b8a6] border-[#0f766e] text-[#ccfbf1]',
    cardClass: 'hover:border-[#5eead4] hover:shadow-[0_24px_60px_rgba(20,184,166,0.14)]',
  },
  {
    date: '2026 年 05 月 20 日',
    title: 'Agent 架构升级',
    description: '重构 Agent 服务，接入 E2B Node.js 22+ 沙箱、MCP 工具适配器、官方 Skills 同步和 Model Router；流式 Agent 支持 runtime session 复用、运行事件追踪与沙箱启动控制。',
    yearClass: 'bg-[#ede9fe] text-[#3b1b69]',
    markerClass: 'bg-[#8b5cf6] border-[#7c3aed] text-[#ede9fe]',
    cardClass: 'hover:border-[#c4b5fd] hover:shadow-[0_24px_60px_rgba(139,92,246,0.14)]',
  },
  {
    date: '2026 年 05 月 13 日',
    title: '积分与资产管理完善',
    description: '完善积分预扣、确认、失败回滚流程；生成接口通过服务端代理隐藏密钥，前端只接收可访问的资源 URL。',
    yearClass: 'bg-[#fef3c7] text-[#5c3b09]',
    markerClass: 'bg-[#f59e0b] border-[#d97706] text-[#fef3c7]',
    cardClass: 'hover:border-[#fcd34d] hover:shadow-[0_24px_60px_rgba(245,158,11,0.14)]',
  },
  {
    date: '2026 年 05 月 03 日',
    title: 'MusesSystem 0.02',
    description: '新增时间线页面、接入 HappyHorse 视频模型，并切换 Agent 助手能力；多模态模型目录开始作为画布和时间线的共享配置来源。',
    modelGroups: supportedModelGroups,
    yearClass: 'bg-[#ffe1e8] text-[#5b172a]',
    markerClass: 'bg-[#ff5c7a] border-[#e54866] text-[#ffe1e8]',
    cardClass: 'hover:border-[#fda4b7] hover:shadow-[0_24px_60px_rgba(255,92,122,0.14)]',
  },
  {
    date: '2026 年 05 月 01 日',
    title: 'MusesSystem 0.01',
    description: 'AI 创作系统启动，整合画布、内容生成与多模态工作流。',
    yearClass: 'bg-[#dbeafe] text-[#132f64]',
    markerClass: 'bg-[#3b82f6] border-[#2563eb] text-[#dbeafe]',
    cardClass: 'hover:border-[#93c5fd] hover:shadow-[0_24px_60px_rgba(59,130,246,0.14)]',
  },
  {
    date: '2023 年 - 2025 年',
    title: '技术沉淀',
    description: '完成核心 AI 能力和产品基础设施的早期积累。',
    yearClass: 'bg-[#dcfce7] text-[#0f3f2c]',
    markerClass: 'bg-[#f8f8f6] border-[#10b981] text-[#10b981]',
    cardClass: 'hover:border-[#86efac] hover:shadow-[0_24px_60px_rgba(16,185,129,0.14)]',
  },
] as const;
