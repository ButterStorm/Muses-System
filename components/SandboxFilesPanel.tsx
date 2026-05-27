'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Download, File, Folder, FolderOpen, GripVertical, Loader2, RefreshCw } from 'lucide-react';

interface SandboxFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  mimeType?: string;
}

const ROOT_PATH = '/home/user/musesAOS';

export default function SandboxFilesPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const [position, setPosition] = useState({ x: 24, y: 585 });
  const [dragging, setDragging] = useState(false);
  const [currentPath, setCurrentPath] = useState(ROOT_PATH);
  const [entries, setEntries] = useState<SandboxFileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [error, setError] = useState('');
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const canGoUp = currentPath !== ROOT_PATH && currentPath.startsWith(`${ROOT_PATH}/`);

  const clampPosition = useCallback((nextX: number, nextY: number) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const panelWidth = rect?.width || 176;
    const panelHeight = rect?.height || 48;
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

  const loadEntries = useCallback(async () => {
    if (collapsed) return;
    setIsLoading(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/agent/sandbox/files?path=${encodeURIComponent(currentPath)}`, {
        headers,
      });
      const data = await response.json().catch(() => null) as { entries?: SandboxFileEntry[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || '读取沙箱文件失败');
      }
      setEntries(data?.entries || []);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : '读取沙箱文件失败');
    } finally {
      setIsLoading(false);
    }
  }, [collapsed, currentPath]);

  useEffect(() => {
    if (!collapsed) {
      loadEntries();
    }
  }, [collapsed, currentPath, loadEntries]);

  const parentPath = useMemo(() => {
    const next = currentPath.split('/').slice(0, -1).join('/') || ROOT_PATH;
    return next.startsWith(ROOT_PATH) ? next : ROOT_PATH;
  }, [currentPath]);

  const handleDownload = async (entry: SandboxFileEntry) => {
    setDownloadingPath(entry.path);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/agent/sandbox/download?path=${encodeURIComponent(entry.path)}`, {
        headers,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || '下载沙箱文件失败');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = entry.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载沙箱文件失败');
    } finally {
      setDownloadingPath(null);
    }
  };

  return (
    <div
      ref={panelRef}
      style={{ left: position.x, top: position.y }}
      className={`absolute z-50 select-none ${dragging ? 'cursor-grabbing' : ''}`}
    >
      <div className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white/95 shadow-xl shadow-black/8 backdrop-blur-xl ${collapsed ? 'w-44' : 'h-[min(58vh,460px)] w-[340px]'}`}>
        <div
          onPointerDown={handlePointerDown}
          className={`flex touch-none cursor-grab items-center justify-between border-b border-gray-100 px-3 py-2.5 active:cursor-grabbing ${dragging ? 'bg-gray-50' : 'hover:bg-gray-50/70'} transition-colors`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <GripVertical size={12} className="shrink-0 text-gray-300" />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <FolderOpen size={14} />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-600">沙箱文件</div>
              {!collapsed && <div className="truncate text-[10px] text-gray-400">{currentPath}</div>}
            </div>
          </div>
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title={collapsed ? '展开沙箱文件' : '收起沙箱文件'}
          >
            {collapsed ? '+' : '−'}
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <button
                onClick={() => setCurrentPath(parentPath)}
                disabled={!canGoUp || isLoading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                title="上一级"
              >
                <ArrowUp size={15} />
              </button>
              <button
                onClick={() => setCurrentPath(ROOT_PATH)}
                disabled={isLoading}
                className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                根目录
              </button>
              <button
                onClick={() => loadEntries()}
                disabled={isLoading}
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                title="刷新"
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : undefined} />
              </button>
            </div>

            {error && (
              <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
            )}

            <div className="flex-1 overflow-y-auto bg-gray-50/70 p-2">
              {isLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                  <Loader2 size={22} className="animate-spin" />
                  <span className="text-xs">读取中...</span>
                </div>
              ) : entries.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">没有可显示的文件</div>
              ) : (
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => entry.type === 'directory' ? setCurrentPath(entry.path) : handleDownload(entry)}
                      className="group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white hover:shadow-sm"
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${entry.type === 'directory' ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'}`}>
                        {entry.type === 'directory' ? <Folder size={15} /> : <File size={15} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-gray-700">{entry.name}</span>
                        <span className="block text-[11px] text-gray-400">
                          {entry.type === 'directory' ? '文件夹' : formatBytes(entry.size)}
                        </span>
                      </span>
                      {entry.type === 'file' && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-700">
                          {downloadingPath === entry.path ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
