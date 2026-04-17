import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAvailableVoices } from '@/services/AudioService';
import type { MusicGenerationMode, UnifiedNodeData } from './unified-types';

interface ConfigPanelProps {
    nodeData: UnifiedNodeData;
    setNodeData: React.Dispatch<React.SetStateAction<UnifiedNodeData>>;
    bgColor: string;
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
                    className={`w-full pl-3 pr-10 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 ${ringColor} transition-all font-medium text-gray-700`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">秒</span>
            </div>
            <div className="px-1 text-[10px] text-gray-400">
                范围：{videoRange.min}-{videoRange.max} 秒（默认 5 秒）
            </div>
        </div>
    );
}

function getVideoDurationRange(model: string): { min: number; max: number } {
    if (model === 'kling') return { min: 5, max: 10 };
    if (model === 'seedance-2-0') return { min: 4, max: 15 };
    return { min: 4, max: 12 };
}

export default function ConfigPanel({ nodeData, setNodeData, bgColor, ringColor }: ConfigPanelProps) {
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
        ? '时长 (秒)'
        : nodeData.type === 'audio'
            ? '音色'
            : nodeData.type === 'music'
                ? '模式'
                : '生成数量';

    return (
        <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">{label}</div>

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
                <MusicConfig nodeData={nodeData} setNodeData={setNodeData} bgColor={bgColor} ringColor={ringColor} />
            ) : (
                <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4].map(n => (
                        <button
                            key={n}
                            onClick={() => setNodeData(prev => ({ ...prev, count: n }))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${nodeData.count === n ? `${bgColor} text-white shadow-md` : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
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
                className={`w-full pl-3 pr-8 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 ${ringColor} transition-all cursor-pointer font-medium text-gray-700 text-left`}
            >
                {selected?.label || String(value)}
            </button>
            <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            <div
                className={`absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md shadow-2xl rounded-xl border border-gray-100 py-1 z-50 origin-top transition-all duration-150 ${
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
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                            value === option.value
                                ? 'font-semibold text-gray-800 bg-gray-50'
                                : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function MusicConfig({ nodeData, setNodeData, bgColor, ringColor }: ConfigPanelProps) {
    return (
        <>
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => setNodeData(prev => ({ ...prev, musicMode: 'inspiration' as MusicGenerationMode }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${nodeData.musicMode === 'inspiration' ? `${bgColor} text-white shadow-md` : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                >
                    灵感模式
                </button>
                <button
                    onClick={() => setNodeData(prev => ({ ...prev, musicMode: 'custom' as MusicGenerationMode }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${nodeData.musicMode === 'custom' ? `${bgColor} text-white shadow-md` : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                >
                    自定义模式
                </button>
            </div>
            {nodeData.musicMode === 'inspiration' ? (
                <div className="flex items-center justify-between px-1 py-1">
                    <span className="text-[11px] font-bold text-gray-400">纯音乐</span>
                    <button
                        onClick={() => setNodeData(prev => ({ ...prev, instrumental: !prev.instrumental }))}
                        className={`w-10 h-5 rounded-full transition-all duration-200 ${nodeData.instrumental ? bgColor : 'bg-gray-200'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${nodeData.instrumental ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    <input
                        type="text"
                        value={nodeData.songTitle}
                        onChange={(e) => setNodeData(prev => ({ ...prev, songTitle: e.target.value }))}
                        placeholder="歌曲标题"
                        className={`w-full px-3 py-1.5 bg-gray-50 border-none rounded-lg text-xs focus:ring-2 ${ringColor} transition-all text-gray-700 placeholder:text-gray-300`}
                    />
                    <input
                        type="text"
                        value={nodeData.songTags}
                        onChange={(e) => setNodeData(prev => ({ ...prev, songTags: e.target.value }))}
                        placeholder="风格标签，如 pop, upbeat"
                        className={`w-full px-3 py-1.5 bg-gray-50 border-none rounded-lg text-xs focus:ring-2 ${ringColor} transition-all text-gray-700 placeholder:text-gray-300`}
                    />
                </div>
            )}
        </>
    );
}
