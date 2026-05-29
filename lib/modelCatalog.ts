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
    { id: 'doubao-seed-2-0-lite-260215', label: 'Doubao Seed 2.0 Lite' },
    { id: 'grok-4.3', label: 'Grok 4.3' },
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
    { id: 'chirp-fenix', label: 'Suno V5.5' },
    { id: 'chirp-crow', label: 'Suno V5' },
    { id: 'chirp-bluejay', label: 'Suno V4.5+' },
    { id: 'chirp-auk', label: 'Suno V4.5' },
    { id: 'chirp-v4', label: 'Suno V4' },
    { id: 'chirp-v3-5', label: 'Suno V3.5' },
    { id: 'music-2.5', label: 'Minimax Music 2.5' },
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

export function getModelLabel(type: NodeType, modelId: string): string {
  return MODEL_CATALOG[type].find((model) => model.id === modelId)?.label || modelId;
}

export function getVideoDurationRange(model: string): VideoDurationRange {
  return VIDEO_DURATION_RANGES[model] || VIDEO_DURATION_RANGES.doubao;
}
