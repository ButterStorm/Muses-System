'use client';

import React, { useState, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Upload, Loader2 } from 'lucide-react';
import { uploadImage } from '@/lib/storage';

const ACCEPT_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
const defaultImage = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop";

const ImageInputNode = ({ id, data }: NodeProps) => {
    const { setNodes } = useReactFlow();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const imageUrl = (data as any).imageUrl as string || '';

    const updateNodeData = (updates: Record<string, any>) => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, ...updates } };
                }
                return node;
            })
        );
    };

    const handleFile = async (file: File) => {
        setError('');

        setUploading(true);
        try {
            const url = await uploadImage(file);
            await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = url;
            });
            updateNodeData({ imageUrl: url });
        } catch (e: any) {
            setError(e.message || '上传失败');
        } finally {
            setUploading(false);
        }
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) handleFile(file);
    };

    const displayUrl = imageUrl || defaultImage;

    return (
        <div className="group">
            <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest">图片参考</div>
            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100 p-2 w-64 relative transition-all duration-300 hover:shadow-3xl hover:border-blue-100 group">
                <div
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 cursor-pointer"
                    onClick={() => !uploading && inputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                >
                    <img
                        src={displayUrl}
                        alt="Reference"
                        className="w-full h-full object-cover"
                    />

                    {uploading && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 z-10">
                            <div className="bg-white/90 p-3 rounded-full shadow-lg">
                                <Loader2 size={22} className="text-gray-700 animate-spin" />
                            </div>
                            <span className="text-white text-xs font-medium drop-shadow">上传中...</span>
                        </div>
                    )}

                    {!uploading && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="bg-white/90 p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                                <Upload size={18} className="text-gray-700" />
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-red-500 text-[10px] mt-1.5 px-1 truncate">{error}</p>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT_TYPES}
                    onChange={onInputChange}
                    className="hidden"
                />
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-gray-300 !border-0 hover:!bg-blue-400 transition-colors"
            />
        </div>
    );
};

export default ImageInputNode;
