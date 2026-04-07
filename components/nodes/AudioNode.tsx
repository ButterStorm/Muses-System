'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Volume2, Download, Play, Copy, Check } from 'lucide-react';

interface AudioNodeData {
  label: string;
  prompt: string;
  audioUrl: string;
  output: string;
}

const AudioNode = ({ data }: NodeProps) => {
  const nodeData = data as unknown as AudioNodeData;
  const [copied, setCopied] = React.useState(false);

  const handleDownload = () => {
    if (nodeData.audioUrl) {
      window.open(nodeData.audioUrl, '_blank');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(nodeData.audioUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制链接失败:', err);
    }
  };

  return (
    <div className="group relative">
      <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
        <Volume2 size={12} />
        <span>音频生成结果</span>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-[2rem] shadow-2xl border border-purple-100 p-2 w-72 transition-all duration-300 hover:shadow-3xl hover:border-purple-200">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-purple-300 !border-0"
        />

        <div className="p-4 space-y-4">
          {nodeData.audioUrl ? (
            <div className="space-y-3">
              <div className="bg-purple-50 rounded-2xl p-4 flex items-center justify-between group/audio transition-colors hover:bg-purple-100">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-purple-500 rounded-xl text-white shadow-lg shadow-purple-200 group-hover/audio:scale-105 transition-transform">
                    <Play size={18} fill="white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-tighter">生成的音频</span>
                    <span className="text-[10px] text-gray-400 font-bold">已就绪</span>
                  </div>
                </div>

                <button
                  onClick={handleCopyLink}
                  className="p-2 text-gray-400 hover:text-purple-600 hover:bg-white rounded-lg transition-all"
                  title="复制链接"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-400 hover:text-purple-600 hover:bg-white rounded-lg transition-all"
                  title="下载"
                >
                  <Download size={18} />
                </button>
              </div>

              <audio src={nodeData.audioUrl} controls className="w-full h-8 opacity-50 hover:opacity-100 transition-opacity" />
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-gray-300 space-y-2">
              <Volume2 size={40} strokeWidth={1} />
              <span className="text-[10px] font-bold uppercase tracking-widest">无音频输出</span>
            </div>
          )}

        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-purple-300 !border-0"
        />
      </div>
    </div>
  );
};

export default AudioNode;
