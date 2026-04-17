'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { ChevronDown, Loader2, Play } from 'lucide-react';
import { generateTextWithDmx } from '@/services/TextService';
import { generateImageWithDmx } from '@/services/ImageService';
import { generateVideoKling, generateVideoDoubao, generateVideoSeedance20 } from '@/services/VideoService';
import { textToSpeech } from '@/services/AudioService';
import { generateMusicInspiration, generateMusicCustom } from '@/services/MusicService';
import { TYPE_CONFIG, MODELS } from './unified-types';
import type { NodeType, MusicGenerationMode, UnifiedNodeData } from './unified-types';
import ConfigPanel from './ConfigPanel';

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
    const { border: borderColor, bg: bgColor, text: textColor, textMuted: textMutedColor, ring: ringColor } = config.classes;
    const availableModels = MODELS[nodeData.type];

    return (
        <div className={`bg-white rounded-2xl shadow-xl border-2 ${borderColor} w-72 overflow-visible relative transition-all duration-300`}>
            <Handle type="target" position={Position.Left} className="!w-3 !h-3 !-left-1.5 !bg-gray-200 !border-2 !border-white shadow-sm" />

            <div ref={typeMenuRef} className="p-3 border-b border-gray-100 relative">
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
                    <div ref={modelMenuRef} className="relative group nodrag">
                        <button
                            type="button"
                            onClick={() => setIsModelMenuOpen(prev => !prev)}
                            className={`w-full pl-3 pr-8 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 ${ringColor} transition-all cursor-pointer font-medium text-gray-700 text-left`}
                        >
                            {nodeData.model}
                        </button>
                        <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                        <div
                            className={`absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md shadow-2xl rounded-xl border border-gray-100 py-1 z-50 origin-top transition-all duration-150 ${
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
                                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                        nodeData.model === model
                                            ? `${textColor} font-semibold bg-gray-50`
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {model}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <ConfigPanel nodeData={nodeData} setNodeData={setNodeData} bgColor={bgColor} ringColor={ringColor} />

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
