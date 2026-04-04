'use client';

import React, { useState } from 'react';
import { Plus, Save, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import UserMenu from './UserMenu';
import { useProjectStore } from '@/stores/projectStore';

interface ToolbarProps {
  onAddNode: (type: string, label: string) => void;
  onSave: () => Promise<void>;
  projectName?: string;
  onRename?: (name: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAddNode, onSave, projectName, onRename }) => {
  const { isSaving } = useProjectStore();
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(projectName || 'MusesSystem');

  const finishEdit = () => {
    setEditing(false);
    if (name.trim() && name.trim() !== projectName && onRename) {
      onRename(name.trim());
    }
  };

  const handleAddTextInputNode = () => {
    onAddNode('textInputNode', '文本输入');
  };

  const handleAddImageInputNode = () => {
    onAddNode('imageInputNode', '图片参考');
  };

  const handleAddUnifiedNode = () => {
    onAddNode('unifiedNode', '文生文');
  };

  const handleSave = async () => {
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      console.error('Save failed:', e);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md shadow-sm p-3 flex items-center justify-between border-b border-gray-100 px-8 sticky top-0 z-[100]">
      <div className="flex items-center space-x-3">
        <Link href="/" className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 overflow-hidden border border-gray-100 hover:shadow-blue-200 transition-shadow flex-shrink-0">
          <img src="/bs_logo.jpeg" alt="Logo" className="w-full h-full object-cover" />
        </Link>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') { setName(projectName || 'MusesSystem'); setEditing(false); } }}
            className="text-sm font-black text-gray-900 tracking-tight leading-none bg-gray-100 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 w-40"
            autoFocus
          />
        ) : (
          <h2
            onClick={() => { setName(projectName || 'MusesSystem'); setEditing(true); }}
            className="text-sm font-black text-gray-900 tracking-tight leading-none cursor-pointer hover:text-blue-600 transition-colors"
            title="点击修改项目名称"
          >
            {projectName || 'MusesSystem'}
          </h2>
        )}
      </div>

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

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 flex items-center space-x-2 shadow-sm active:scale-95 disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check size={16} />
              <span className="text-sm font-bold">已保存</span>
            </>
          ) : isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm font-bold">保存中</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span className="text-sm font-bold">保存</span>
            </>
          )}
        </button>

        <div className="h-8 w-px bg-gray-200 mx-2" />

        <UserMenu />
      </div>
    </div>
  );
};

export default Toolbar;
