'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import UserMenu from './UserMenu';

interface ToolbarProps {
  onAddNode: (type: string, label: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAddNode }) => {
  const handleAddTextInputNode = () => {
    onAddNode('textInputNode', '文本输入');
  };

  const handleAddImageInputNode = () => {
    onAddNode('imageInputNode', '图片参考');
  };

  const handleAddUnifiedNode = () => {
    onAddNode('unifiedNode', '文生文');
  };

  return (
    <div className="bg-white/80 backdrop-blur-md shadow-sm p-3 flex items-center justify-between border-b border-gray-100 px-8 sticky top-0 z-[100]">
      <Link href="/" className="flex items-center space-x-3 group cursor-pointer">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 overflow-hidden border border-gray-100 group-hover:shadow-blue-200 transition-shadow">
          <img src="/bs_logo.jpeg" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-sm font-black text-gray-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors">MusesSystem</h2>
        </div>
      </Link>

      <div className="flex items-center space-x-3">
        <div className="flex bg-gray-100 p-1 rounded-xl space-x-1 mr-4">
          <button
            onClick={handleAddTextInputNode}
            className="px-3 py-1.5 hover:bg-white rounded-lg transition-all text-[11px] font-bold text-gray-600 hover:text-black hover:shadow-sm"
          >
            + 文本输入
          </button>
          <button
            onClick={handleAddImageInputNode}
            className="px-3 py-1.5 hover:bg-white rounded-lg transition-all text-[11px] font-bold text-gray-600 hover:text-black hover:shadow-sm"
          >
            + 图片参考
          </button>
        </div>

        <button
          onClick={handleAddUnifiedNode}
          className="px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all duration-300 flex items-center space-x-2 shadow-xl shadow-gray-200 active:scale-95 group"
        >
          <div className="bg-white/20 p-1 rounded-lg group-hover:rotate-90 transition-transform duration-300">
            <Plus size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold">新生成节点</span>
        </button>

        <div className="h-8 w-px bg-gray-200 mx-2" />

        <UserMenu />
      </div>
    </div>
  );
};

export default Toolbar;