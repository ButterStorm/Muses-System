'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Maximize2, FileText } from 'lucide-react';
import TextModal from '../modals/TextModal';

interface TextNodeData {
  label: string;
  prompt: string;
  output: string;
}

const TextNode = ({ data }: NodeProps) => {
  const nodeData = data as unknown as TextNodeData;
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getPreviewText = (text: string, maxLength: number = 200): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="group relative">
      <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
        <FileText size={12} />
        <span>文本生成结果</span>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-blue-100 p-4 w-72 transition-all duration-300 hover:shadow-2xl hover:border-blue-200">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-blue-300 !border-0"
        />

        <div
          className="relative cursor-pointer group/content"
          onClick={() => setIsModalOpen(true)}
        >
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {getPreviewText(nodeData.output)}
          </div>

          {nodeData.output && nodeData.output.length > 200 && (
            <div className="mt-2 flex items-center text-blue-500 text-[10px] font-bold uppercase tracking-wider group-hover/content:translate-x-1 transition-transform">
              查看全文 →
            </div>
          )}

          <div className="absolute top-0 right-0 opacity-0 group-hover/content:opacity-100 transition-opacity">
            <Maximize2 size={14} className="text-gray-300 hover:text-blue-500" />
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-blue-300 !border-0"
        />
      </div>

      <TextModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={nodeData.output}
        title="生成文本内容"
      />
    </div>
  );
};

export default TextNode;
