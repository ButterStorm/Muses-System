import React from 'react';
import { ChevronDown } from 'lucide-react';
import { getAvailableVoices } from '@/services/AudioService';
import type { NodeType, MusicGenerationMode, UnifiedNodeData } from './unified-types';

interface ConfigPanelProps {
    nodeData: UnifiedNodeData;
    setNodeData: React.Dispatch<React.SetStateAction<UnifiedNodeData>>;
    bgColor: string;
    ringColor: string;
}

export default function ConfigPanel({ nodeData, setNodeData, bgColor, ringColor }: ConfigPanelProps) {
    const voices = getAvailableVoices();

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
                <div className="relative">
                    <select
                        value={nodeData.duration}
                        onChange={(e) => setNodeData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                        className={`w-full pl-3 pr-8 py-2 bg-gray-50 border-none rounded-xl text-sm appearance-none focus:ring-2 ${ringColor} transition-all cursor-pointer font-medium text-gray-700`}
                    >
                        <option value={5}>5秒</option>
                        <option value={10}>10秒</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
            ) : nodeData.type === 'audio' ? (
                <div className="relative">
                    <select
                        value={nodeData.voice}
                        onChange={(e) => setNodeData(prev => ({ ...prev, voice: e.target.value }))}
                        className={`w-full pl-3 pr-8 py-2 bg-gray-50 border-none rounded-xl text-sm appearance-none focus:ring-2 ${ringColor} transition-all cursor-pointer font-medium text-gray-700`}
                    >
                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
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
