export type NodeType = 'text' | 'image' | 'video' | 'audio' | 'music';
export type MusicGenerationMode = 'inspiration' | 'custom';
export { MODELS } from '@/lib/modelCatalog';

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
    accent: string;
    classes: {
        border: string;
        bg: string;
        bgMuted: string;
        text: string;
        textMuted: string;
        ring: string;
        dot: string;
    };
    icon: string;
}> = {
    text: {
        label: '文生文',
        color: 'slate',
        accent: '#6366f1',
        classes: { border: 'border-slate-200/80', bg: 'bg-slate-800', bgMuted: 'bg-slate-50', text: 'text-slate-700', textMuted: 'text-slate-400', ring: 'focus:ring-slate-500/20', dot: 'bg-indigo-400' },
        icon: 'text'
    },
    image: {
        label: '文生图',
        color: 'emerald',
        accent: '#34d399',
        classes: { border: 'border-slate-200/80', bg: 'bg-slate-800', bgMuted: 'bg-slate-50', text: 'text-slate-700', textMuted: 'text-slate-400', ring: 'focus:ring-emerald-500/20', dot: 'bg-emerald-400' },
        icon: 'image'
    },
    video: {
        label: '文生视频',
        color: 'violet',
        accent: '#a78bfa',
        classes: { border: 'border-slate-200/80', bg: 'bg-slate-800', bgMuted: 'bg-slate-50', text: 'text-slate-700', textMuted: 'text-slate-400', ring: 'focus:ring-violet-500/20', dot: 'bg-violet-400' },
        icon: 'video'
    },
    audio: {
        label: '文生音效',
        color: 'rose',
        accent: '#fb7185',
        classes: { border: 'border-slate-200/80', bg: 'bg-slate-800', bgMuted: 'bg-slate-50', text: 'text-slate-700', textMuted: 'text-slate-400', ring: 'focus:ring-rose-500/20', dot: 'bg-rose-400' },
        icon: 'audio'
    },
    music: {
        label: '文生音乐',
        color: 'amber',
        accent: '#fbbf24',
        classes: { border: 'border-slate-200/80', bg: 'bg-slate-800', bgMuted: 'bg-slate-50', text: 'text-slate-700', textMuted: 'text-slate-400', ring: 'focus:ring-amber-500/20', dot: 'bg-amber-400' },
        icon: 'music'
    },
};
