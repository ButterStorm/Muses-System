'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Upload, Loader2, Image as ImageIcon, Video as VideoIcon, Music2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { uploadFile, uploadImage } from '@/lib/storage';

const ACCEPT_TYPES = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/mov,video/quicktime,audio/mp3,audio/wav,audio/mpeg';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop';

type ReferenceKind = 'image' | 'video' | 'audio';

interface ReferenceLists {
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
}

function dedupeUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)));
}

function toUrlList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function getListsFromData(data: Record<string, unknown>): ReferenceLists {
  return {
    imageUrls: dedupeUrls([...toUrlList(data.imageUrls), ...toUrlList(data.imageUrl)]),
    videoUrls: dedupeUrls([...toUrlList(data.videoUrls), ...toUrlList(data.videoUrl)]),
    audioUrls: dedupeUrls([...toUrlList(data.audioUrls), ...toUrlList(data.audioUrl)]),
  };
}

function withLists(data: Record<string, unknown>, lists: ReferenceLists): Record<string, unknown> {
  return {
    ...data,
    imageUrls: lists.imageUrls,
    videoUrls: lists.videoUrls,
    audioUrls: lists.audioUrls,
    // 兼容旧字段，保留首个 URL
    imageUrl: lists.imageUrls[0] || '',
    videoUrl: lists.videoUrls[0] || '',
    audioUrl: lists.audioUrls[0] || '',
  };
}

function getUrlsByKind(lists: ReferenceLists, kind: ReferenceKind): string[] {
  if (kind === 'image') return lists.imageUrls;
  if (kind === 'video') return lists.videoUrls;
  return lists.audioUrls;
}

function hasAnyPreview(lists: ReferenceLists): boolean {
  return lists.imageUrls.length > 0 || lists.videoUrls.length > 0 || lists.audioUrls.length > 0;
}

const ImageInputNode = ({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [activeKind, setActiveKind] = useState<ReferenceKind>('image');
  const [previewIndexByKind, setPreviewIndexByKind] = useState<Record<ReferenceKind, number>>({
    image: 0,
    video: 0,
    audio: 0,
  });
  const [previewLists, setPreviewLists] = useState<ReferenceLists>({
    imageUrls: [],
    videoUrls: [],
    audioUrls: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const updateLists = (updater: (current: ReferenceLists) => ReferenceLists) => {
    let nextPreview: ReferenceLists | null = null;
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const currentData = node.data as Record<string, unknown>;
        const currentLists = getListsFromData(currentData);
        const nextLists = updater(currentLists);
        nextPreview = nextLists;
        return { ...node, data: withLists(currentData, nextLists) };
      })
    );
    if (nextPreview) {
      setPreviewLists(nextPreview);
    }
  };

  const appendUrl = (kind: ReferenceKind, url: string) => {
    updateLists((current) => {
      if (kind === 'image') return { ...current, imageUrls: dedupeUrls([url, ...current.imageUrls]) };
      if (kind === 'video') return { ...current, videoUrls: dedupeUrls([url, ...current.videoUrls]) };
      return { ...current, audioUrls: dedupeUrls([url, ...current.audioUrls]) };
    });
    setPreviewIndexByKind((prev) => ({ ...prev, [kind]: 0 }));
    setActiveKind(kind);
  };

  const removeByKindIndex = (kind: ReferenceKind, index: number) => {
    updateLists((current) => {
      if (kind === 'image') {
        return { ...current, imageUrls: current.imageUrls.filter((_, i) => i !== index) };
      }
      if (kind === 'video') {
        return { ...current, videoUrls: current.videoUrls.filter((_, i) => i !== index) };
      }
      return { ...current, audioUrls: current.audioUrls.filter((_, i) => i !== index) };
    });
  };

  const detectKind = (file: File): ReferenceKind | null => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return null;
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError('');
    setUploading(true);

    try {
      for (const file of files) {
        const kind = detectKind(file);
        if (!kind) continue;

        const url = kind === 'image' ? await uploadImage(file) : await uploadFile(file);
        appendUrl(kind, url);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await handleFiles(files);
    e.target.value = '';
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    await handleFiles(files);
  };

  useEffect(() => {
    const currentData = (data || {}) as Record<string, unknown>;
    setPreviewLists(getListsFromData(currentData));
  }, [data]);

  useEffect(() => {
    const activeUrls = getUrlsByKind(previewLists, activeKind);
    if (activeUrls.length > 0) return;

    if (previewLists.imageUrls.length > 0) {
      setActiveKind('image');
      return;
    }
    if (previewLists.videoUrls.length > 0) {
      setActiveKind('video');
      return;
    }
    if (previewLists.audioUrls.length > 0) {
      setActiveKind('audio');
    }
  }, [previewLists, activeKind]);

  useEffect(() => {
    setPreviewIndexByKind((prev) => {
      const next = { ...prev };
      (['image', 'video', 'audio'] as ReferenceKind[]).forEach((kind) => {
        const len = getUrlsByKind(previewLists, kind).length;
        if (len === 0) {
          next[kind] = 0;
        } else if (next[kind] > len - 1) {
          next[kind] = len - 1;
        }
      });
      return next;
    });
  }, [previewLists]);

  const activeUrls = getUrlsByKind(previewLists, activeKind);
  const activeIndex = Math.min(previewIndexByKind[activeKind], Math.max(activeUrls.length - 1, 0));
  const activeUrl = activeUrls[activeIndex] || '';

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeUrls.length <= 1) return;
    setPreviewIndexByKind((prev) => ({
      ...prev,
      [activeKind]: (prev[activeKind] - 1 + activeUrls.length) % activeUrls.length,
    }));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeUrls.length <= 1) return;
    setPreviewIndexByKind((prev) => ({
      ...prev,
      [activeKind]: (prev[activeKind] + 1) % activeUrls.length,
    }));
  };

  return (
    <div className="group">
      <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest">多模态参考</div>
      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100 p-2 w-72 relative transition-all duration-300 hover:shadow-3xl hover:border-blue-100">
        <div className="mb-2 grid grid-cols-3 gap-1">
          <KindButton
            kind="image"
            icon={<ImageIcon size={13} />}
            activeKind={activeKind}
            count={previewLists.imageUrls.length}
            onClick={setActiveKind}
          />
          <KindButton
            kind="video"
            icon={<VideoIcon size={13} />}
            activeKind={activeKind}
            count={previewLists.videoUrls.length}
            onClick={setActiveKind}
          />
          <KindButton
            kind="audio"
            icon={<Music2 size={13} />}
            activeKind={activeKind}
            count={previewLists.audioUrls.length}
            onClick={setActiveKind}
          />
        </div>

        <div
          className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group/preview"
          onClick={() => {
            if (!uploading && !activeUrl) {
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {renderPreview(activeKind, activeUrl)}

          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 z-10">
              <div className="bg-white/90 p-3 rounded-full shadow-lg">
                <Loader2 size={22} className="text-gray-700 animate-spin" />
              </div>
              <span className="text-white text-xs font-medium drop-shadow">上传中...</span>
            </div>
          )}

          {!uploading && !activeUrl && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <div className="bg-white/90 p-2 rounded-full shadow-lg">
                <Upload size={18} className="text-gray-700" />
              </div>
            </div>
          )}

          {activeUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeByKindIndex(activeKind, activeIndex);
              }}
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow text-gray-500 hover:text-gray-700 opacity-0 group-hover/preview:opacity-100 transition-opacity"
              title="移除当前预览"
            >
              <X size={14} />
            </button>
          )}

          {activeUrls.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/90 rounded-full shadow text-gray-500 hover:text-gray-700 opacity-0 group-hover/preview:opacity-100 transition-opacity"
                title="上一项"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/90 rounded-full shadow text-gray-500 hover:text-gray-700 opacity-0 group-hover/preview:opacity-100 transition-opacity"
                title="下一项"
              >
                <ChevronRight size={14} />
              </button>
            </>
          )}
        </div>

        <div className="mt-2 px-1 flex items-center justify-between gap-2">
          <div className="text-[10px] text-gray-400 truncate">
            {!hasAnyPreview(previewLists)
              ? '支持图片 / 视频 / 音频拖拽上传'
              : `当前预览：${activeKind === 'image' ? '图片' : activeKind === 'video' ? '视频' : '音频'} ${activeUrls.length > 0 ? `${activeIndex + 1}/${activeUrls.length}` : ''}`}
          </div>
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-[11px] font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Upload size={12} />
            <span>上传</span>
          </button>
        </div>

        {error && <p className="text-red-500 text-[10px] mt-1.5 px-1 truncate">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_TYPES}
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-gray-300 !border-0 hover:!bg-blue-400 transition-colors"
      />
    </div>
  );
};

function KindButton({
  kind,
  icon,
  activeKind,
  count,
  onClick,
}: {
  kind: ReferenceKind;
  icon: React.ReactNode;
  activeKind: ReferenceKind;
  count: number;
  onClick: (kind: ReferenceKind) => void;
}) {
  const isActive = activeKind === kind;
  return (
    <button
      type="button"
      onClick={() => onClick(kind)}
      className={`px-2 py-1.5 rounded-lg transition-all text-[11px] font-semibold flex items-center justify-center gap-1 ${
        isActive ? 'bg-white shadow-sm text-gray-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
      }`}
    >
      {icon}
      <span>{count}</span>
    </button>
  );
}

function renderPreview(kind: ReferenceKind, url: string) {
  if (kind === 'image') {
    return (
      <img
        src={url || DEFAULT_IMAGE}
        alt="Reference"
        className="w-full h-full object-cover"
      />
    );
  }

  if (kind === 'video') {
    if (!url) {
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
          <VideoIcon size={52} strokeWidth={1.5} />
        </div>
      );
    }
    return (
      <video
        src={url}
        className="w-full h-full object-cover"
        controls
        playsInline
      />
    );
  }

  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300">
        <Music2 size={52} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center mb-3 text-gray-500">
        <Music2 size={24} />
      </div>
      <audio src={url} controls className="w-full h-9 opacity-70 hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default ImageInputNode;
