'use client';

import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Image as ImageIcon, Upload } from 'lucide-react';

const ImageInputNode = ({ id, data }: NodeProps) => {
    const { setNodes } = useReactFlow();
    const [imageUrl, setImageUrl] = useState(data.imageUrl as string || '');
    const defaultImage = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop";

    useEffect(() => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, imageUrl } };
                }
                return node;
            })
        );
    }, [imageUrl, id, setNodes]);

    return (
        <div className="group">
            <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest">图片参考</div>
            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100 p-2 w-64 relative transition-all duration-300 hover:shadow-3xl hover:border-blue-100 group">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100">
                    {imageUrl || defaultImage ? (
                        <>
                            <img
                                src={imageUrl || defaultImage}
                                alt="Reference"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <button className="bg-white/90 p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                                    <Upload size={18} className="text-gray-700" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <ImageIcon size={32} />
                            <span className="text-xs font-bold">点击上传图片</span>
                        </div>
                    )}
                </div>
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
