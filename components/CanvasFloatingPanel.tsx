'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, GripVertical, Type, ImagePlus, Sparkles } from 'lucide-react';

interface CanvasFloatingPanelProps {
  onAddNode: (type: string, label: string) => void;
}

const CanvasFloatingPanel: React.FC<CanvasFloatingPanelProps> = ({ onAddNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  return (
    <div
      ref={panelRef}
      style={{ left: position.x, top: position.y }}
      className={`absolute z-50 select-none ${dragging ? 'cursor-grabbing' : ''}`}
    >
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/8 border border-gray-200/60 overflow-hidden">
        {/* Header - draggable */}
        <div
          onMouseDown={handleMouseDown}
          className={`flex items-center justify-between px-3 py-2 border-b border-gray-100 cursor-grab active:cursor-grabbing ${dragging ? 'bg-gray-50' : 'hover:bg-gray-50/50'} transition-colors`}
        >
          <div className="flex items-center gap-1.5">
            <GripVertical size={12} className="text-gray-300" />
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">节点工具</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <span className="text-xs">{collapsed ? '+' : '−'}</span>
          </button>
        </div>

        {/* Body */}
        {!collapsed && (
          <div className="p-2 flex flex-col gap-1.5">
            <button
              onClick={() => onAddNode('textInputNode', '文本输入')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100/80 transition-all text-gray-600 hover:text-gray-900 group"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Type size={13} className="text-blue-500" />
              </div>
              <span className="text-xs font-semibold">文本输入</span>
            </button>

            <button
              onClick={() => onAddNode('imageInputNode', '多模态参考')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100/80 transition-all text-gray-600 hover:text-gray-900 group"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <ImagePlus size={13} className="text-purple-500" />
              </div>
              <span className="text-xs font-semibold">多模态参考</span>
            </button>

            <div className="my-0.5 border-t border-gray-100" />

            <button
              onClick={() => onAddNode('unifiedNode', '文生文')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-black transition-all text-white shadow-lg shadow-gray-300/40 active:scale-[0.97] group"
            >
              <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
                <Sparkles size={13} className="text-white" />
              </div>
              <span className="text-xs font-bold">新生成节点</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasFloatingPanel;
