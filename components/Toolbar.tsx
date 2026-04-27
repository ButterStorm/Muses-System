'use client';

import React, { useState } from 'react';
import { Save, Check, Loader2, LayoutGrid, Sparkles } from 'lucide-react';
import Link from 'next/link';
import UserMenu from './UserMenu';
import { useProjectStore } from '@/stores/projectStore';

export type ViewMode = 'canvas' | 'space';

interface ToolbarProps {
  onSave: () => Promise<void>;
  projectName?: string;
  onRename?: (name: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onSave, projectName, onRename, viewMode, onViewModeChange }) => {
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
        {/* 画布/空间切换 */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => onViewModeChange('canvas')}
            className={`px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 text-[11px] font-bold ${
              viewMode === 'canvas'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <LayoutGrid size={13} />
            画布
          </button>
          <button
            onClick={() => onViewModeChange('space')}
            className={`px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 text-[11px] font-bold ${
              viewMode === 'space'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Sparkles size={13} />
            空间
          </button>
        </div>

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
