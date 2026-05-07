'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, Type, ImagePlus, Sparkles, Clapperboard, Brush, Music2, MessageSquareText, ExternalLink } from 'lucide-react';

interface CanvasFloatingPanelProps {
  onAddNode: (type: string, label: string, initialData?: Record<string, unknown>) => void;
}

const promptTemplates = [
  {
    label: '画面描述',
    icon: Brush,
    color: 'emerald',
    prompt: '画面主体：\n场景环境：\n风格氛围：\n光影色彩：\n构图镜头：\n细节要求：',
  },
  {
    label: '分镜脚本',
    icon: Clapperboard,
    color: 'amber',
    prompt: '镜头 1：\n画面：\n动作：\n镜头运动：\n时长：\n\n镜头 2：\n画面：\n动作：\n镜头运动：\n时长：',
  },
  {
    label: '文案扩写',
    icon: MessageSquareText,
    color: 'sky',
    prompt: '主题：\n目标受众：\n表达语气：\n关键信息：\n输出形式：\n请扩写为一段清晰、有画面感、适合生成内容的提示词。',
  },
  {
    label: '音乐灵感',
    icon: Music2,
    color: 'rose',
    prompt: '音乐风格：\n情绪氛围：\n节奏速度：\n主要乐器：\n使用场景：\n避免元素：',
  },
];

const templateColorClasses: Record<string, { bg: string; text: string; hoverBg: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500', hoverBg: 'group-hover:bg-emerald-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-500', hoverBg: 'group-hover:bg-amber-100' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-500', hoverBg: 'group-hover:bg-sky-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-500', hoverBg: 'group-hover:bg-rose-100' },
};

const CanvasFloatingPanel: React.FC<CanvasFloatingPanelProps> = ({ onAddNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const clampPosition = useCallback((nextX: number, nextY: number) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const panelWidth = rect?.width || 0;
    const panelHeight = rect?.height || 0;
    const maxX = Math.max(0, window.innerWidth - panelWidth);
    const maxY = Math.max(0, window.innerHeight - panelHeight);

    return {
      x: Math.min(Math.max(0, nextX), maxX),
      y: Math.min(Math.max(0, nextY), maxY),
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const handlePointerMove = (e: PointerEvent) => {
      setPosition(clampPosition(
        e.clientX - dragOffset.current.x,
        e.clientY - dragOffset.current.y
      ));
    };
    const handlePointerUp = () => setDragging(false);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clampPosition, dragging]);

  return (
    <div
      ref={panelRef}
      style={{ left: position.x, top: position.y }}
      className={`absolute z-50 select-none ${dragging ? 'cursor-grabbing' : ''}`}
    >
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/8 border border-gray-200/60 overflow-hidden">
        {/* Header - draggable */}
        <div
          onPointerDown={handlePointerDown}
          className={`flex touch-none items-center justify-between px-3 py-2 border-b border-gray-100 cursor-grab active:cursor-grabbing ${dragging ? 'bg-gray-50' : 'hover:bg-gray-50/50'} transition-colors`}
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
          <div className="flex flex-col">
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

            <div className="border-t border-gray-100">
              <div className="px-3 pt-2 pb-1">
                <a
                  href="https://prompt.ai-magic.top"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 tracking-wider uppercase transition-colors"
                >
                  <span>提示模板</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="px-2 pb-2 flex flex-col gap-1.5">
                {promptTemplates.map(({ label, icon: Icon, color, prompt }) => {
                  const classes = templateColorClasses[color];

                  return (
                    <button
                      key={label}
                      onClick={() => onAddNode('textInputNode', label, { text: prompt })}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100/80 transition-all text-gray-600 hover:text-gray-900 group"
                    >
                      <div className={`w-7 h-7 rounded-lg ${classes.bg} ${classes.hoverBg} flex items-center justify-center transition-colors`}>
                        <Icon size={13} className={classes.text} />
                      </div>
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasFloatingPanel;
