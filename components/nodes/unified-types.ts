export type NodeType = 'text' | 'image' | 'video' | 'audio' | 'music';
export type MusicGenerationMode = 'inspiration' | 'custom';

export interface UnifiedNodeData {
    label: string;
    type: NodeType;
    model: string;
    count: number;
    duration: number;
    voice: string;
    musicMode: MusicGenerationMode;
    instrumental: boolean;
    songTitle: string;
    songTags: string;
    isLoading: boolean;
}

export const TYPE_CONFIG: Record<NodeType, {
    label: string;
    color: string;
    classes: {
        border: string;
        bg: string;
        bgMuted: string;
        text: string;
        textMuted: string;
        ring: string;
    };
    icon: string;
}> = {
    text: {
        label: '文生文',
        color: 'blue',
        classes: { border: 'border-blue-400', bg: 'bg-blue-500', bgMuted: 'bg-blue-50/50', text: 'text-blue-600', textMuted: 'text-blue-400', ring: 'focus:ring-blue-500/20' },
        icon: 'text'
    },
    image: {
        label: '文生图',
        color: 'green',
        classes: { border: 'border-green-400', bg: 'bg-green-500', bgMuted: 'bg-green-50/50', text: 'text-green-600', textMuted: 'text-green-400', ring: 'focus:ring-green-500/20' },
        icon: 'image'
    },
    video: {
        label: '文生视频',
        color: 'indigo',
        classes: { border: 'border-indigo-400', bg: 'bg-indigo-500', bgMuted: 'bg-indigo-50/50', text: 'text-indigo-600', textMuted: 'text-indigo-400', ring: 'focus:ring-indigo-500/20' },
        icon: 'video'
    },
    audio: {
        label: '文生音效',
        color: 'purple',
        classes: { border: 'border-purple-400', bg: 'bg-purple-500', bgMuted: 'bg-purple-50/50', text: 'text-purple-600', textMuted: 'text-purple-400', ring: 'focus:ring-purple-500/20' },
        icon: 'audio'
    },
    music: {
        label: '文生音乐',
        color: 'orange',
        classes: { border: 'border-orange-400', bg: 'bg-orange-500', bgMuted: 'bg-orange-50/50', text: 'text-orange-600', textMuted: 'text-orange-400', ring: 'focus:ring-orange-500/20' },
        icon: 'music'
    },
};

export const MODELS: Record<NodeType, string[]> = {
    text: ['gpt-5-mini', 'deepseek-v4-flash', 'deepseek-v4-pro', 'kimi-k2.5', 'doubao-seed-1-8-251228'],
    image: ['doubao-seedream-5.0-lite', 'gemini-3-pro-image', 'gemini-2.5-flash-image', 'gpt-image-2'],
    video: ['kling', 'doubao', 'seedance-2-0'],
    audio: ['speech-2.6-hd'],
    music: ['suno-v5'],
};
