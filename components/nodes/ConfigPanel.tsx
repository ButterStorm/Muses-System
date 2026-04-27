import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAvailableVoices } from '@/services/AudioService';
import { getVideoDurationRange } from '@/lib/modelCatalog';
import type { MusicGenerationMode, UnifiedNodeData } from './unified-types';

interface ConfigPanelProps {
    nodeData: UnifiedNodeData;
    setNodeData: React.Dispatch<React.SetStateAction<UnifiedNodeData>>;
    accent: string;
    ringColor: string;
}

interface DropdownOption {
    value: string | number;
    label: string;
}

interface VideoDurationFieldProps {
    duration: number;
    videoRange: { min: number; max: number };
    ringColor: string;
    onChange: (duration: number) => void;
}

function VideoDurationField({ duration, videoRange, ringColor, onChange }: VideoDurationFieldProps) {
    const [inputValue, setInputValue] = useState(String(duration));

    useEffect(() => {
        setInputValue(String(duration));
    }, [duration]);

    return (
        <div className="space-y-1">
            <div className="relative">
                <input
                    type="number"
                    min={videoRange.min}
                    max={videoRange.max}
                    step={1}
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                    }}
                    onBlur={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        const next = Number.isNaN(parsed) ? 5 : Math.max(videoRange.min, Math.min(videoRange.max, parsed));
                        onChange(next);
                    }}
                    className={`w-full pl-3 pr-10 py-2 bg-slate-50/80 border border-slate-100 rounded-xl text-[13px] focus:ring-2 ${ringColor} transition-all font-medium text-slate-600`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium">秒</span>
            </div>
            <div className="px-0.5 text-[10px] text-slate-400">
                {videoRange.min}-{videoRange.max} 秒
            </div>
        </div>
    );
}

export default function ConfigPanel({ nodeData, setNodeData, accent, ringColor }: ConfigPanelProps) {
    const voices = getAvailableVoices();
    const videoRange = useMemo(
        () => getVideoDurationRange(nodeData.model),
        [nodeData.model]
    );

    const voiceOptions = useMemo(
        () => voices.map((v) => ({ value: v.id, label: v.name })),
        [voices]
    );

    const label = nodeData.type === 'video'
        ? '时长'
        : nodeData.type === 'audio'
            ? '音色'
            : nodeData.type === 'music'
                ? '模式'
                : '数量';

    return (
        <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-0.5">{label}</div>

            {nodeData.type === 'video' ? (
                <VideoDurationField
                    duration={nodeData.duration}
                    videoRange={videoRange}
                    ringColor={ringColor}
                    onChange={(duration) => setNodeData(prev => ({ ...prev, duration }))}
                />
            ) : nodeData.type === 'audio' ? (
                <DropdownField
                    value={nodeData.voice}
                    options={voiceOptions}
                    ringColor={ringColor}
                    onChange={(value) => setNodeData(prev => ({ ...prev, voice: String(value) }))}
                />
            ) : nodeData.type === 'music' ? (
                <MusicConfig nodeData={nodeData} setNodeData={setNodeData} accent={accent} ringColor={ringColor} />
            ) : (
                <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map(n => (
                        <button
                            key={n}
                            onClick={() => setNodeData(prev => ({ ...prev, count: n }))}
                            className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                                nodeData.count === n
                                    ? 'text-white shadow-sm'
                                    : 'bg-slate-50/80 border border-slate-100 text-slate-400 hover:text-slate-500 hover:bg-slate-50'
                            }`}
                            style={nodeData.count === n ? { backgroundColor: accent } : undefined}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function DropdownField({
    value,
    options,
    ringColor,
    onChange,
}: {
    value: string | number;
    options: DropdownOption[];
    ringColor: string;
    onChange: (value: string | number) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = options.find((option) => option.value === value);

    return (
        <div ref={menuRef} className="relative group nodrag">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`w-full pl-3 pr-8 py-2 bg-slate-50/80 border border-slate-100 rounded-xl text-[13px] focus:ring-2 ${ringColor} transition-all cursor-pointer font-medium text-slate-600 text-left hover:bg-slate-50`}
            >
                {selected?.label || String(value)}
            </button>
            <ChevronDown size={12} className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            <div
                className={`absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-2xl shadow-2xl rounded-xl border border-slate-100 py-1 z-50 origin-top transition-all duration-200 ${
                    isOpen
                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                }`}
            >
                {options.map((option) => (
                    <button
                        key={String(option.value)}
                        type="button"
                        onClick={() => {
                            onChange(option.value);
                            setIsOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                            value === option.value
                                ? 'font-medium text-slate-900 bg-slate-50/80'
                                : 'text-slate-500 hover:bg-slate-50/80'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function MusicConfig({ nodeData, setNodeData, accent, ringColor }: ConfigPanelProps) {
    return (
        <>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => setNodeData(prev => ({ ...prev, musicMode: 'inspiration' as MusicGenerationMode }))}
                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                        nodeData.musicMode === 'inspiration' ? 'text-white shadow-sm' : 'bg-slate-50/80 border border-slate-100 text-slate-400 hover:text-slate-500'
                    }`}
                    style={nodeData.musicMode === 'inspiration' ? { backgroundColor: accent } : undefined}
                >
                    灵感模式
                </button>
                <button
                    onClick={() => setNodeData(prev => ({ ...prev, musicMode: 'custom' as MusicGenerationMode }))}
                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                        nodeData.musicMode === 'custom' ? 'text-white shadow-sm' : 'bg-slate-50/80 border border-slate-100 text-slate-400 hover:text-slate-500'
                    }`}
                    style={nodeData.musicMode === 'custom' ? { backgroundColor: accent } : undefined}
                >
                    自定义模式
                </button>
            </div>
            {nodeData.musicMode === 'inspiration' ? (
                <div className="flex items-center justify-between px-1 py-1.5">
                    <span className="text-[11px] font-medium text-slate-400">纯音乐</span>
                    <button
                        onClick={() => setNodeData(prev => ({ ...prev, instrumental: !prev.instrumental }))}
                        className={`w-9 h-5 rounded-full transition-all duration-200 relative`}
                        style={{ backgroundColor: nodeData.instrumental ? accent : '#e2e8f0' }}
                    >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 absolute top-[3px] ${nodeData.instrumental ? 'left-[17px]' : 'left-[3px]'}`} />
                    </button>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <input
                        type="text"
                        value={nodeData.songTitle}
                        onChange={(e) => setNodeData(prev => ({ ...prev, songTitle: e.target.value }))}
                        placeholder="歌曲标题"
                        className={`w-full px-3 py-1.5 bg-slate-50/80 border border-slate-100 rounded-lg text-[12px] focus:ring-2 ${ringColor} transition-all text-slate-600 placeholder:text-slate-300`}
                    />
                    <input
                        type="text"
                        value={nodeData.songTags}
                        onChange={(e) => setNodeData(prev => ({ ...prev, songTags: e.target.value }))}
                        placeholder="风格标签，如 pop, upbeat"
                        className={`w-full px-3 py-1.5 bg-slate-50/80 border border-slate-100 rounded-lg text-[12px] focus:ring-2 ${ringColor} transition-all text-slate-600 placeholder:text-slate-300`}
                    />
                </div>
            )}
        </>
    );
}
