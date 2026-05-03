import type { NodeType } from '@/components/nodes/unified-types';

export interface ModelOption {
  id: string;
  label: string;
}

export interface VideoDurationRange {
  min: number;
  max: number;
  defaultValue: number;
}

export const MODEL_CATALOG: Record<NodeType, ModelOption[]> = {
  text: [
    { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'doubao-seed-1-8-251228', label: 'Doubao Seed 1.8' },
  ],
  image: [
    { id: 'doubao-seedream-5.0-lite', label: 'Doubao Seedream 5.0 Lite' },
    { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image' },
    { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
    { id: 'gpt-image-2', label: 'GPT Image 2' },
  ],
  video: [
    { id: 'kling', label: 'Kling' },
    { id: 'doubao', label: 'Doubao' },
    { id: 'seedance-2-0', label: 'Seedance 2.0' },
    { id: 'happyhorse', label: 'HappyHorse 1.0' },
  ],
  audio: [
    { id: 'speech-2.6-hd', label: 'Speech 2.6 HD' },
  ],
  music: [
    { id: 'suno-v5', label: 'Suno V5' },
  ],
};

export const MODELS: Record<NodeType, string[]> = Object.fromEntries(
  Object.entries(MODEL_CATALOG).map(([type, models]) => [
    type,
    models.map((model) => model.id),
  ])
) as Record<NodeType, string[]>;

const VIDEO_DURATION_RANGES: Record<string, VideoDurationRange> = {
  kling: { min: 5, max: 10, defaultValue: 5 },
  'seedance-2-0': { min: 4, max: 15, defaultValue: 5 },
  happyhorse: { min: 3, max: 15, defaultValue: 5 },
  doubao: { min: 4, max: 12, defaultValue: 5 },
};

export function getDefaultModel(type: NodeType): string {
  return MODELS[type][0];
}

export function getVideoDurationRange(model: string): VideoDurationRange {
  return VIDEO_DURATION_RANGES[model] || VIDEO_DURATION_RANGES.doubao;
}
