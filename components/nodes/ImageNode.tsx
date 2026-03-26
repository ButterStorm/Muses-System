'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Maximize2, Download, Image as ImageIcon } from 'lucide-react';
import ImageModal from '../modals/ImageModal';

interface ImageNodeData {
  label: string;
  prompt: string;
  imageUrl: string;
}

const ImageNode = ({ data }: NodeProps) => {
  const nodeData = data as unknown as ImageNodeData;
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await fetch(nodeData.imageUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = nodeData.imageUrl.split('/').pop()?.split('?')[0] || 'generated-image.png';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(nodeData.imageUrl, '_blank');
    }
  };

  return (
    <div className="group relative">
      <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
        <ImageIcon size={12} />
        <span>图片生成结果</span>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-[2rem] shadow-2xl border border-green-100 p-2 w-72 transition-all duration-300 hover:shadow-3xl hover:border-green-200">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-green-300 !border-0"
        />

        <div className="relative aspect-square rounded-[1.5rem] overflow-hidden bg-gray-50 group/img">
          {nodeData.imageUrl ? (
            <>
              <img
                src={nodeData.imageUrl}
                alt="Generated"
                className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
              />
              <div
                className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={() => setIsModalOpen(true)}
              >
                <Maximize2 size={24} className="text-white drop-shadow-lg" />
              </div>

              <button
                onClick={handleDownload}
                className="absolute bottom-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg opacity-0 group-hover/img:opacity-100 translate-y-2 group-hover/img:translate-y-0 transition-all text-gray-700 hover:text-green-600"
              >
                <Download size={18} />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImageIcon size={48} strokeWidth={1} />
            </div>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-green-300 !border-0"
        />
      </div>

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageUrl={nodeData.imageUrl}
        title="生成图片预览"
      />
    </div>
  );
};

export default ImageNode;
