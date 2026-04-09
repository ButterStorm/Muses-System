'use client';

import React from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Video, Download, Play, Copy, Check } from 'lucide-react';

interface VideoNodeData {
  label: string;
  prompt: string;
  videoUrl: string;
}

const VideoNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as VideoNodeData;
  const [copied, setCopied] = React.useState(false);

  const handleDownload = () => {
    if (nodeData.videoUrl) {
      window.open(nodeData.videoUrl, '_blank');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(nodeData.videoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制链接失败:', err);
    }
  };

  return (
    <div className="group relative">
      <NodeResizer
        color="#818cf8"
        isVisible={selected}
        minWidth={200}
        minHeight={150}
      />

      <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
        <Video size={12} />
        <span>{nodeData.label || '视频生成结果'}</span>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-[2rem] shadow-2xl border border-indigo-100 p-2 w-full transition-all duration-300 hover:shadow-3xl hover:border-indigo-200">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-indigo-300 !border-0"
        />

        <div className="relative aspect-video rounded-[1.5rem] overflow-hidden bg-gray-50 group/video">
          {nodeData.videoUrl ? (
            <>
              <video
                src={nodeData.videoUrl}
                className="w-full h-full object-cover"
                onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                onMouseLeave={(e) => {
                  const v = (e.target as HTMLVideoElement);
                  v.pause();
                  v.currentTime = 0;
                }}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/video:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <Play size={32} className="text-white drop-shadow-lg" fill="currentColor" />
              </div>

              <div className="absolute bottom-3 right-3 flex items-center space-x-2 opacity-0 group-hover/video:opacity-100 translate-y-2 group-hover/video:translate-y-0 transition-all">
                <button
                  onClick={handleCopyLink}
                  className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg text-gray-700 hover:text-indigo-600 transition-colors"
                  title="复制链接"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg text-gray-700 hover:text-indigo-600 transition-colors"
                  title="下载"
                >
                  <Download size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Video size={48} strokeWidth={1} />
            </div>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-indigo-300 !border-0"
        />
      </div>
    </div>
  );
};

export default VideoNode;
