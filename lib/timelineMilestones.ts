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
    date: '2026 年 05 月 03 日',
    title: 'MusesSystem 0.02',
    description: '新增时间线页面、接入 HappyHorse 视频模型，并将agent助手进行切换。',
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
