'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Music, Download, ListMusic } from 'lucide-react';

interface MusicNodeData {
  label: string;
  musicUrl: string;
  musicImageUrl?: string;
}

const MusicNode = ({ data }: NodeProps) => {
  const nodeData = data as unknown as MusicNodeData;
  const [currentUrl] = useState(nodeData.musicUrl);

  const handleDownload = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="group relative">
      <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
        <Music size={12} />
        <span>音乐生成结果</span>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-[2rem] shadow-2xl border border-orange-100 p-2 w-72 transition-all duration-300 hover:shadow-3xl hover:border-orange-200">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-orange-300 !border-0"
        />

        <div className="p-4 space-y-4">
          {currentUrl ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                {nodeData.musicImageUrl && (
                  <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 shadow-lg">
                    <img
                      src={nodeData.musicImageUrl}
                      alt="Cover"
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                )}

                <div className="w-full bg-orange-50 rounded-2xl p-4 flex items-center justify-between group/music transition-colors hover:bg-orange-100">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="p-3 bg-orange-500 rounded-xl text-white shadow-lg shadow-orange-200 group-hover/music:scale-105 transition-transform flex-shrink-0">
                      <ListMusic size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-tighter truncate">
                        {nodeData.label || '生成的音乐'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold tracking-widest">Suno AI</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(currentUrl)}
                    className="p-2 text-gray-400 hover:text-orange-600 hover:bg-white rounded-lg transition-all flex-shrink-0"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>

              <div className="px-1">
                <audio
                  src={currentUrl}
                  controls
                  className="w-full h-8 opacity-60 hover:opacity-100 transition-opacity [&::-webkit-media-controls-enclosure]:rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-gray-300 space-y-2">
              <Music size={40} strokeWidth={1} />
              <span className="text-[10px] font-bold uppercase tracking-widest">无音乐输出</span>
            </div>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-orange-300 !border-0"
        />
      </div>
    </div>
  );
};

export default MusicNode;
