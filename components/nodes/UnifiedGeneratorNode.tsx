'use client';

import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { ChevronDown, Loader2, Play } from 'lucide-react';
import { generateTextWithDmx } from '@/services/TextService';
import { generateImageWithDmx } from '@/services/ImageService';
import { generateVideoKling, generateVideoDoubao } from '@/services/VideoService';
import { textToSpeech, getAvailableVoices } from '@/services/AudioService';
import { generateMusicInspiration, generateMusicCustom } from '@/services/MusicService';

type NodeType = 'text' | 'image' | 'video' | 'audio' | 'music';
type MusicGenerationMode = 'inspiration' | 'custom';

interface UnifiedNodeData {
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

const TYPE_CONFIG: Record<NodeType, { label: string; color: string; classes: { border: string; bg: string; bgMuted: string; text: string; textMuted: string; ring: string }; icon: string }> = {
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

const MODELS = {
    text: ['gpt-5-mini', 'deepseek-chat', 'kimi-k2.5', 'doubao-seed-1-8-251228'],
    image: ['doubao-seedream-5.0-lite', 'gemini-3-pro-image', 'gemini-2.5-flash-image'],
    video: ['kling', 'doubao'],
    audio: ['speech-2.6-hd', 'openai-tts-1'],
    music: ['suno-v5'],
};

const UnifiedGeneratorNode = ({ id, data }: NodeProps) => {
    const voices = getAvailableVoices();
    const { addNodes, addEdges, getNode, getEdges, getNodes, setNodes } = useReactFlow();

    const [nodeData, setNodeData] = useState<UnifiedNodeData>(() => {
        const nodeType = (data.type as NodeType) || 'text';
        return {
            label: data.label as string || '文生文',
            type: nodeType,
            model: (data.model as string) || MODELS[nodeType]?.[0] || MODELS.text[0],
            count: (data.count as number) || 1,
            duration: (data.duration as number) || 5,
            voice: (data.voice as string) || voices[0].id,
            musicMode: (data.musicMode as MusicGenerationMode) || 'inspiration',
            instrumental: (data.instrumental as boolean) || false,
            songTitle: (data.songTitle as string) || '',
            songTags: (data.songTags as string) || '',
            isLoading: false,
        };
    });

    const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // 同步配置回 ReactFlow node data（排除 isLoading）
    useEffect(() => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            label: nodeData.label,
                            type: nodeData.type,
                            model: nodeData.model,
                            count: nodeData.count,
                            duration: nodeData.duration,
                            voice: nodeData.voice,
                            musicMode: nodeData.musicMode,
                            instrumental: nodeData.instrumental,
                            songTitle: nodeData.songTitle,
                            songTags: nodeData.songTags,
                        },
                    };
                }
                return node;
            })
        );
    }, [nodeData.label, nodeData.type, nodeData.model, nodeData.count, nodeData.duration, nodeData.voice, nodeData.musicMode, nodeData.instrumental, nodeData.songTitle, nodeData.songTags, id, setNodes]);

    const handleTypeChange = (type: NodeType) => {
        setNodeData(prev => ({
            ...prev,
            type,
            model: MODELS[type][0],
            label: TYPE_CONFIG[type].label,
        }));
        setIsTypeMenuOpen(false);
    };

    const handleGenerate = async () => {
        setNodeData(prev => ({ ...prev, isLoading: true }));
        setErrorMessage(null);

        try {
            const edges = getEdges();
            const nodes = getNodes();

            const sourceNodeIds = edges
                .filter(edge => edge.target === id)
                .map(edge => edge.source);

            const sourceNodes = nodes.filter(node => sourceNodeIds.includes(node.id));

            // Collect text and images from all upstream nodes
            let latestPrompt = '';
            const collectedImageUrls: string[] = [];

            for (const node of sourceNodes) {
                const d = node.data as any;
                // textInputNode: data.text
                // textNode (result): data.output
                if (d.text) {
                    latestPrompt = d.text;
                } else if (d.output) {
                    latestPrompt = typeof d.output === 'string' ? d.output : '';
                }
                // imageInputNode / imageNode: data.imageUrl
                if (d.imageUrl && !collectedImageUrls.includes(d.imageUrl)) {
                    collectedImageUrls.push(d.imageUrl);
                }
            }

            const inputImages = collectedImageUrls.length > 0 ? collectedImageUrls : undefined;

            const promptToUse = latestPrompt || "A unique and creative concept";
            const count = (nodeData.type === 'text' || nodeData.type === 'image') ? nodeData.count : 1;

            const currentNode = getNode(id);
            const basePosition = currentNode
                ? { x: currentNode.position.x + 350, y: currentNode.position.y }
                : { x: 800, y: 300 };

            let nodeCounter = 0;
            for (let i = 0; i < count; i++) {
                let generationResults: any = '';

                switch (nodeData.type) {
                    case 'text':
                        generationResults = await generateTextWithDmx(promptToUse, nodeData.model, inputImages?.[0]);
                        break;
                    case 'image':
                        generationResults = await generateImageWithDmx(nodeData.model, promptToUse, '2K', inputImages);
                        break;
                    case 'video':
                        if (nodeData.model === 'kling') {
                            generationResults = await generateVideoKling(promptToUse, nodeData.duration as 5 | 10, '9:16', inputImages?.[0]);
                        } else {
                            generationResults = await generateVideoDoubao(promptToUse, '16:9', inputImages?.[0], nodeData.duration as 5 | 10);
                        }
                        break;
                    case 'audio':
                        generationResults = await textToSpeech(promptToUse, { model: nodeData.model, voice: nodeData.voice });
                        break;
                    case 'music': {
                        // 前端显示 suno-v5，实际 API 调用 chirp-v5
                        const apiMv = nodeData.model === 'suno-v5' ? 'chirp-v5' : nodeData.model;
                        if (nodeData.musicMode === 'inspiration') {
                            generationResults = await generateMusicInspiration(promptToUse, {
                                mv: apiMv,
                                make_instrumental: nodeData.instrumental,
                            });
                        } else {
                            generationResults = await generateMusicCustom(promptToUse, nodeData.songTitle || 'Untitled', {
                                tags: nodeData.songTags || undefined,
                                mv: apiMv,
                            });
                        }
                        break;
                    }
                }

                const resultsArray = Array.isArray(generationResults) ? generationResults : [generationResults];

                for (const singleResult of resultsArray) {
                    const newNodeId = `result-${Date.now()}-${nodeCounter}`;
                    const position = {
                        x: basePosition.x,
                        y: basePosition.y + (nodeCounter * 230)
                    };

                    let newNodeType = 'textNode';
                    let newNodeData: any = { label: '生成结果', prompt: promptToUse };

                    switch (nodeData.type) {
                        case 'text':
                            newNodeType = 'textNode';
                            newNodeData.output = singleResult;
                            break;
                        case 'image':
                            newNodeType = 'imageNode';
                            newNodeData.imageUrl = singleResult;
                            break;
                        case 'video':
                            newNodeType = 'videoNode';
                            newNodeData.videoUrl = singleResult;
                            break;
                        case 'audio':
                            newNodeType = 'audioNode';
                            newNodeData.audioUrl = singleResult;
                            break;
                        case 'music':
                            newNodeType = 'musicNode';
                            newNodeData.musicUrl = singleResult.audio_url;
                            newNodeData.musicImageUrl = singleResult.image_url;
                            newNodeData.isLoading = false;
                            break;
                    }

                    addNodes({
                        id: newNodeId,
                        type: newNodeType,
                        position,
                        data: newNodeData,
                        ...(newNodeType === 'textNode' ? { style: { width: 288, height: 150 } } : {}),
                    });

                    addEdges({
                        id: `e-${id}-${newNodeId}`,
                        source: id,
                        target: newNodeId,
                        animated: true,
                        style: { stroke: '#94a3b8', strokeWidth: 2 },
                    });

                    nodeCounter++;
                }
            }

            setNodeData(prev => ({ ...prev, isLoading: false }));
        } catch (error: any) {
            console.error("Generation error:", error);
            setErrorMessage(error.message || '生成失败');
            setNodeData(prev => ({ ...prev, isLoading: false }));
        }
    };

    const config = TYPE_CONFIG[nodeData.type];
    const { border: borderColor, bg: bgColor, text: textColor, textMuted: textMutedColor, ring: ringColor } = config.classes;

    return (
        <div className={`bg-white rounded-2xl shadow-xl border-2 ${borderColor} w-72 overflow-visible relative transition-all duration-300`}>
            <Handle type="target" position={Position.Left} className="!w-3 !h-3 !-left-1.5 !bg-gray-200 !border-2 !border-white shadow-sm" />

            <div className="p-3 border-b border-gray-100 relative">
                <div
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setIsTypeMenuOpen(!isTypeMenuOpen)}
                >
                    <div className="flex items-center space-x-2">
                        <span className={`text-lg font-bold ${textColor}`}>{nodeData.label}</span>
                        <ChevronDown size={16} className={`${textMutedColor} group-hover:translate-y-0.5 transition-transform`} />
                    </div>
                    <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 uppercase tracking-wider">
                        {nodeData.type}
                    </div>
                </div>

                {isTypeMenuOpen && (
                    <div className="absolute top-12 left-2 right-2 bg-white/95 backdrop-blur-md shadow-2xl rounded-xl border border-gray-100 py-2 z-50">
                        {(Object.keys(TYPE_CONFIG) as NodeType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => handleTypeChange(type)}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${nodeData.type === type ? `${TYPE_CONFIG[type].classes.text} font-semibold ${TYPE_CONFIG[type].classes.bgMuted}` : 'text-gray-600'}`}
                            >
                                <span>{TYPE_CONFIG[type].label}</span>
                                {nodeData.type === type && <div className={`w-1.5 h-1.5 rounded-full ${TYPE_CONFIG[type].classes.bg}`} />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">模型</div>
                    <div className="relative group">
                        <select
                            value={nodeData.model}
                            onChange={(e) => setNodeData(prev => ({ ...prev, model: e.target.value }))}
                            className={`w-full pl-3 pr-8 py-2 bg-gray-50 border-none rounded-xl text-sm appearance-none focus:ring-2 ${ringColor} transition-all cursor-pointer font-medium text-gray-700`}
                        >
                            {MODELS[nodeData.type].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                        {nodeData.type === 'video' ? '时长 (秒)' : nodeData.type === 'audio' ? '音色' : nodeData.type === 'music' ? '模式' : '生成数量'}
                    </div>

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
                        <>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setNodeData(prev => ({ ...prev, musicMode: 'inspiration' }))}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${nodeData.musicMode === 'inspiration' ? `${bgColor} text-white shadow-md` : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                >
                                    灵感模式
                                </button>
                                <button
                                    onClick={() => setNodeData(prev => ({ ...prev, musicMode: 'custom' }))}
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

                <button
                    onClick={handleGenerate}
                    disabled={nodeData.isLoading}
                    className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 ${bgColor} flex items-center justify-center space-x-2`}
                >
                    {nodeData.isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <>
                            <Play size={16} fill="white" />
                            <span>立即生成</span>
                        </>
                    )}
                </button>

                {errorMessage && (
                    <div className="p-2 rounded-lg bg-red-50 text-red-500 text-[10px] font-medium border border-red-100">
                        {errorMessage}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="!w-3 !h-3 !-right-1.5 !bg-gray-200 !border-2 !border-white shadow-sm" />
        </div>
    );
};

export default UnifiedGeneratorNode;
