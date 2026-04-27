'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { ChevronDown, Play, Sparkles, Type, Image, Video, Music, Headphones } from 'lucide-react';
import { generateTextWithDmx } from '@/services/TextService';
import { generateImageWithDmx } from '@/services/ImageService';
import { generateVideoKling, generateVideoDoubao, generateVideoSeedance20 } from '@/services/VideoService';
import { textToSpeech } from '@/services/AudioService';
import { generateMusicInspiration, generateMusicCustom } from '@/services/MusicService';
import { TYPE_CONFIG, MODELS } from './unified-types';
import type { NodeType, MusicGenerationMode, UnifiedNodeData } from './unified-types';
import ConfigPanel from './ConfigPanel';

const TYPE_ICONS: Record<NodeType, React.ReactNode> = {
    text: <Type size={13} />,
    image: <Image size={13} />,
    video: <Video size={13} />,
    audio: <Headphones size={13} />,
    music: <Music size={13} />,
};

const UnifiedGeneratorNode = ({ id, data }: NodeProps) => {
    const { addNodes, addEdges, getNode, getEdges, getNodes, setNodes } = useReactFlow();

    const [nodeData, setNodeData] = useState<UnifiedNodeData>(() => {
        const nodeType = (data.type as NodeType) || 'text';
        return {
            label: data.label as string || '文生文',
            type: nodeType,
            model: (data.model as string) || MODELS[nodeType]?.[0] || MODELS.text[0],
            count: (data.count as number) || 1,
            duration: (data.duration as number) || 5,
            voice: (data.voice as string) || 'male-qn-qingse',
            musicMode: (data.musicMode as MusicGenerationMode) || 'inspiration',
            instrumental: (data.instrumental as boolean) || false,
            songTitle: (data.songTitle as string) || '',
            songTags: (data.songTags as string) || '',
            isLoading: false,
        };
    });

    const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const typeMenuRef = useRef<HTMLDivElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (typeMenuRef.current && !typeMenuRef.current.contains(target)) {
                setIsTypeMenuOpen(false);
            }
            if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
                setIsModelMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTypeChange = (type: NodeType) => {
        setNodeData(prev => ({
            ...prev,
            type,
            model: MODELS[type][0],
            label: TYPE_CONFIG[type].label,
            ...(type === 'video' ? { duration: 5 } : {}),
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

            let latestPrompt = '';
            const collectedImageUrls: string[] = [];
            const collectedVideoUrls: string[] = [];
            const collectedAudioUrls: string[] = [];

            for (const node of sourceNodes) {
                const d = node.data as Record<string, unknown>;
                const nodeText = typeof d.text === 'string' ? d.text : '';
                const nodeOutputText = typeof d.output === 'string' ? d.output : '';
                if (nodeText) {
                    latestPrompt = nodeText;
                } else if (nodeOutputText) {
                    latestPrompt = nodeOutputText;
                }

                const nodeImageUrls = Array.isArray(d.imageUrls)
                    ? d.imageUrls.filter((v): v is string => typeof v === 'string' && !!v)
                    : [];
                const fallbackImage = typeof d.imageUrl === 'string' && d.imageUrl ? [d.imageUrl] : [];
                for (const imgUrl of [...nodeImageUrls, ...fallbackImage]) {
                    if (!collectedImageUrls.includes(imgUrl)) {
                        collectedImageUrls.push(imgUrl);
                    }
                }

                const nodeVideoUrls = Array.isArray(d.videoUrls)
                    ? d.videoUrls.filter((v): v is string => typeof v === 'string' && !!v)
                    : [];
                const fallbackVideo = typeof d.videoUrl === 'string' && d.videoUrl ? [d.videoUrl] : [];
                for (const videoUrl of [...nodeVideoUrls, ...fallbackVideo]) {
                    if (!collectedVideoUrls.includes(videoUrl)) {
                        collectedVideoUrls.push(videoUrl);
                    }
                }

                const nodeAudioUrls = Array.isArray(d.audioUrls)
                    ? d.audioUrls.filter((v): v is string => typeof v === 'string' && !!v)
                    : [];
                const fallbackAudio = [
                    typeof d.audioUrl === 'string' && d.audioUrl ? d.audioUrl : '',
                    typeof d.musicUrl === 'string' && d.musicUrl ? d.musicUrl : '',
                ].filter(Boolean);
                for (const audioUrl of [...nodeAudioUrls, ...fallbackAudio]) {
                    if (!collectedAudioUrls.includes(audioUrl)) {
                        collectedAudioUrls.push(audioUrl);
                    }
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
                let generationResults: unknown = '';

                switch (nodeData.type) {
                    case 'text':
                        generationResults = await generateTextWithDmx(promptToUse, nodeData.model, inputImages?.[0]);
                        break;
                    case 'image':
                        generationResults = await generateImageWithDmx(nodeData.model, promptToUse, '2K', inputImages);
                        break;
                    case 'video':
                        const requestedDuration = Number(nodeData.duration) || 5;
                        if (nodeData.model === 'kling') {
                            const klingDuration = Math.min(10, Math.max(5, Math.round(requestedDuration)));
                            generationResults = await generateVideoKling(promptToUse, klingDuration, '9:16', inputImages?.[0]);
                        } else if (nodeData.model === 'seedance-2-0') {
                            const seedanceDuration = Math.min(15, Math.max(4, Math.round(requestedDuration)));
                            generationResults = await generateVideoSeedance20(promptToUse, {
                                duration: seedanceDuration,
                                ratio: collectedImageUrls.length > 0 ? 'adaptive' : '16:9',
                                references: {
                                    imageUrls: collectedImageUrls,
                                    videoUrls: collectedVideoUrls,
                                    audioUrls: collectedAudioUrls,
                                },
                            });
                        } else {
                            const doubaoDuration = Math.min(12, Math.max(4, Math.round(requestedDuration)));
                            generationResults = await generateVideoDoubao(promptToUse, '16:9', inputImages?.[0], doubaoDuration, {
                                imageUrls: collectedImageUrls,
                                videoUrls: collectedVideoUrls,
                                audioUrls: collectedAudioUrls,
                            });
                        }
                        break;
                    case 'audio':
                        generationResults = await textToSpeech(promptToUse, { model: nodeData.model, voice: nodeData.voice });
                        break;
                    case 'music': {
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
                    let newNodeData: Record<string, unknown> = { label: `${TYPE_CONFIG[nodeData.type].label} · ${nodeData.model}`, prompt: promptToUse };

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
                            newNodeData.musicUrl = (singleResult as Record<string, unknown>).audio_url;
                            newNodeData.musicImageUrl = (singleResult as Record<string, unknown>).image_url;
                            newNodeData.isLoading = false;
                            break;
                    }

                    addNodes({
                        id: newNodeId,
                        type: newNodeType,
                        position,
                        data: newNodeData,
                        ...(newNodeType === 'textNode' ? { style: { width: 288, height: 150 } } : {}),
                        ...(newNodeType === 'videoNode' ? { style: { width: 288, height: 180 } } : {}),
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
        } catch (error: unknown) {
            console.error("Generation error:", error);
            setErrorMessage(error instanceof Error ? error.message : '生成失败');
            setNodeData(prev => ({ ...prev, isLoading: false }));
        }
    };

    const config = TYPE_CONFIG[nodeData.type];
    const { accent, classes } = config;
    const availableModels = MODELS[nodeData.type];

    return (
        <div className="w-72 relative">
            {/* 连接点 */}
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !-left-1 !bg-slate-300 !border-2 !border-white !shadow-sm !top-8" />

            {/* 主容器 - 毛玻璃 */}
            <div
                className={`bg-white/80 backdrop-blur-xl rounded-2xl border transition-all duration-300 overflow-visible ${
                    nodeData.isLoading
                        ? 'border-slate-300/60 shadow-2xl shadow-slate-200/40'
                        : `${classes.border} shadow-lg shadow-slate-200/30 hover:shadow-xl hover:shadow-slate-200/40`
                }`}
            >
                {/* Header - 类型选择 */}
                <div ref={typeMenuRef} className="px-4 pt-3 pb-2 relative">
                    <div
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setIsTypeMenuOpen(!isTypeMenuOpen)}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                                style={{ backgroundColor: `${accent}15`, color: accent }}
                            >
                                {TYPE_ICONS[nodeData.type]}
                            </div>
                            <span className="text-[13px] font-semibold text-slate-800 tracking-tight">
                                {nodeData.label}
                            </span>
                            <ChevronDown
                                size={13}
                                className="text-slate-300 group-hover:text-slate-500 transition-all group-hover:translate-y-0.5"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            {nodeData.isLoading && (
                                <div className="flex items-center gap-1">
                                    <span className="relative flex h-2 w-2">
                                        <span
                                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                            style={{ backgroundColor: accent }}
                                        />
                                        <span
                                            className="relative inline-flex rounded-full h-2 w-2"
                                            style={{ backgroundColor: accent }}
                                        />
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 类型下拉菜单 */}
                    {isTypeMenuOpen && (
                        <div className="absolute top-12 left-3 right-3 bg-white/95 backdrop-blur-2xl shadow-2xl rounded-xl border border-slate-100 py-1.5 z-50">
                            {(Object.keys(TYPE_CONFIG) as NodeType[]).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => handleTypeChange(type)}
                                    className={`w-full px-3 py-2 text-left text-[13px] flex items-center justify-between hover:bg-slate-50/80 transition-colors ${
                                        nodeData.type === type ? 'font-medium text-slate-900' : 'text-slate-500'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: TYPE_CONFIG[type].accent }}
                                        />
                                        <span>{TYPE_CONFIG[type].label}</span>
                                    </div>
                                    {nodeData.type === type && (
                                        <div
                                            className="w-4 h-0.5 rounded-full"
                                            style={{ backgroundColor: TYPE_CONFIG[type].accent }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 内容区域 */}
                <div className="px-4 pb-4 space-y-3">
                    {/* 模型选择 */}
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-0.5">模型</div>
                        <div ref={modelMenuRef} className="relative group nodrag">
                            <button
                                type="button"
                                onClick={() => setIsModelMenuOpen(prev => !prev)}
                                className={`w-full px-3 py-2 bg-slate-50/80 border border-slate-100 rounded-xl text-[13px] focus:ring-2 ${classes.ring} transition-all cursor-pointer font-medium text-slate-600 text-left flex items-center justify-between hover:bg-slate-50`}
                            >
                                <span>{nodeData.model}</span>
                                <ChevronDown size={12} className={`text-slate-300 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <div
                                className={`absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-2xl shadow-2xl rounded-xl border border-slate-100 py-1 z-50 origin-top transition-all duration-200 ${
                                    isModelMenuOpen
                                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                                }`}
                            >
                                {availableModels.map((model) => (
                                    <button
                                        key={model}
                                        type="button"
                                        onClick={() => {
                                            setNodeData(prev => {
                                                if (prev.type !== 'video') {
                                                    return { ...prev, model };
                                                }
                                                return { ...prev, model, duration: 5 };
                                            });
                                            setIsModelMenuOpen(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                                            nodeData.model === model
                                                ? 'text-slate-900 font-medium bg-slate-50/80'
                                                : 'text-slate-500 hover:bg-slate-50/80'
                                        }`}
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <ConfigPanel nodeData={nodeData} setNodeData={setNodeData} accent={accent} ringColor={classes.ring} />

                    {/* 生成按钮 / 加载状态 */}
                    <button
                        onClick={handleGenerate}
                        disabled={nodeData.isLoading}
                        className={`w-full py-2.5 rounded-xl font-semibold text-[13px] transition-all duration-300 relative overflow-hidden ${
                            nodeData.isLoading
                                ? 'bg-slate-100 text-slate-400 cursor-wait'
                                : 'text-white shadow-md active:scale-[0.98] hover:shadow-lg'
                        }`}
                        style={!nodeData.isLoading ? { backgroundColor: accent } : undefined}
                    >
                        {nodeData.isLoading ? (
                            <div className="flex items-center justify-center gap-2.5">
                                {/* 波浪加载动画 */}
                                <div className="flex items-center gap-[3px]">
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <span
                                            key={i}
                                            className="w-[3px] rounded-full"
                                            style={{
                                                backgroundColor: accent,
                                                height: '12px',
                                                animation: `waveBar 1.2s ease-in-out ${i * 0.1}s infinite`,
                                            }}
                                        />
                                    ))}
                                </div>
                                <span className="tracking-wide">生成中</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <Sparkles size={14} />
                                <span>生成</span>
                            </div>
                        )}
                    </button>

                    {/* 错误提示 */}
                    {errorMessage && (
                        <div className="px-3 py-2 rounded-xl bg-red-50/80 border border-red-100/60 text-red-500 text-[11px] font-medium">
                            {errorMessage}
                        </div>
                    )}
                </div>
            </div>

            {/* 连接点 */}
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !-right-1 !bg-slate-300 !border-2 !border-white !shadow-sm !top-8" />

            {/* 加载动画 keyframes */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes waveBar {
                    0%, 40%, 100% { height: 4px; opacity: 0.4; }
                    20% { height: 14px; opacity: 1; }
                }
            `}} />
        </div>
    );
};

export default UnifiedGeneratorNode;
