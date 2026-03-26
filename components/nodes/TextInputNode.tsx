'use client';

import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';

const TextInputNode = ({ id, data, selected }: NodeProps) => {
    const { setNodes } = useReactFlow();
    const [text, setText] = useState(data.text as string || '画面：金属银猫猫的身体，覆盖银蓝电光形态（全身发电纹）特效：电光外溢、能量爆发');

    useEffect(() => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, text } };
                }
                return node;
            })
        );
    }, [text, id, setNodes]);

    return (
        <div className="group relative h-full w-full">
            <NodeResizer
                minWidth={150}
                minHeight={80}
                isVisible={selected}
                lineClassName="border-blue-400"
                handleClassName="h-2 w-2 bg-white border border-blue-400 rounded-full"
            />

            <div className="absolute -top-6 left-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest pointer-events-none transition-opacity group-hover:opacity-100 opacity-60">
                文本输入
            </div>

            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-4 h-full w-full relative transition-all duration-300 hover:shadow-2xl hover:border-gray-200 flex flex-col overflow-hidden">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="输入内容..."
                    className="w-full h-full bg-transparent border-none focus:ring-0 text-sm text-gray-700 leading-relaxed resize-none p-0 nodrag custom-scrollbar"
                />
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-gray-300 !border-0 hover:!bg-blue-400 transition-colors !top-1/2"
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #f1f5f9;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #e2e8f0;
                }
            `}} />
        </div>
    );
};

export default TextInputNode;
