'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Upload, Loader2, Image as ImageIcon, Video as VideoIcon, Music2, X } from 'lucide-react';
import { uploadFile, uploadImage } from '@/lib/storage';

const ACCEPT_TYPES = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/mov,video/quicktime,audio/mp3,audio/wav,audio/mpeg,audio/mp4,audio/webm';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop';

type ReferenceKind = 'image' | 'video' | 'audio';

interface MediaMetadata {
  url: string;
  name: string;
  type: string;
}

interface ReferenceMedia {
  kind: ReferenceKind;
  url: string;
  name?: string;
  type?: string;
}

function toUrlList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function getMediaMetadata(data: Record<string, unknown>, key: string): MediaMetadata[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is MediaMetadata => (
    !!item &&
    typeof item === 'object' &&
    typeof (item as MediaMetadata).url === 'string' &&
    typeof (item as MediaMetadata).name === 'string' &&
    typeof (item as MediaMetadata).type === 'string'
  ));
}

function getMediaFromData(data: Record<string, unknown>): ReferenceMedia | null {
  const mediaKind = data.mediaKind;
  const mediaUrl = data.mediaUrl;
  if (
    (mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio') &&
    typeof mediaUrl === 'string' &&
    mediaUrl
  ) {
    return {
      kind: mediaKind,
      url: mediaUrl,
      name: typeof data.mediaName === 'string' ? data.mediaName : undefined,
      type: typeof data.mediaType === 'string' ? data.mediaType : undefined,
    };
  }

  const imageUrl = toUrlList(data.imageUrls)[0] || toUrlList(data.imageUrl)[0];
  if (imageUrl) return { kind: 'image', url: imageUrl };

  const videoUrl = toUrlList(data.videoUrls)[0] || toUrlList(data.videoUrl)[0];
  if (videoUrl) {
    const meta = getMediaMetadata(data, 'videoFiles').find((item) => item.url === videoUrl);
    return { kind: 'video', url: videoUrl, name: meta?.name, type: meta?.type };
  }

  const audioUrl = toUrlList(data.audioUrls)[0] || toUrlList(data.audioUrl)[0];
  if (audioUrl) {
    const meta = getMediaMetadata(data, 'audioFiles').find((item) => item.url === audioUrl);
    return { kind: 'audio', url: audioUrl, name: meta?.name, type: meta?.type };
  }

  return null;
}

function detectKind(file: File): ReferenceKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

function buildNodeData(data: Record<string, unknown>, media: ReferenceMedia | null): Record<string, unknown> {
  const base = {
    ...data,
    mediaKind: media?.kind || '',
    mediaUrl: media?.url || '',
    mediaName: media?.name || '',
    mediaType: media?.type || '',
    imageUrl: media?.kind === 'image' ? media.url : '',
    videoUrl: media?.kind === 'video' ? media.url : '',
    audioUrl: media?.kind === 'audio' ? media.url : '',
    imageUrls: media?.kind === 'image' ? [media.url] : [],
    videoUrls: media?.kind === 'video' ? [media.url] : [],
    audioUrls: media?.kind === 'audio' ? [media.url] : [],
    videoFiles: media?.kind === 'video' && media.name && media.type
      ? [{ url: media.url, name: media.name, type: media.type }]
      : [],
    audioFiles: media?.kind === 'audio' && media.name && media.type
      ? [{ url: media.url, name: media.name, type: media.type }]
      : [],
  };

  return base;
}

const kindLabel: Record<ReferenceKind, string> = {
  image: '图片参考',
  video: '视频参考',
  audio: '音频参考',
};

const kindIcon: Record<ReferenceKind, React.ReactNode> = {
  image: <ImageIcon size={12} />,
  video: <VideoIcon size={12} />,
  audio: <Music2 size={12} />,
};

const ImageInputNode = ({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const nodeData = (data || {}) as Record<string, unknown>;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [media, setMedia] = useState<ReferenceMedia | null>(() => getMediaFromData(nodeData));
  const inputRef = useRef<HTMLInputElement>(null);

  const label = useMemo(() => {
    if (media) return kindLabel[media.kind];
    return typeof nodeData.label === 'string' && nodeData.label ? nodeData.label : '参考素材';
  }, [media, nodeData.label]);

  const syncMedia = (nextMedia: ReferenceMedia | null) => {
    setMedia(nextMedia);
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        return { ...node, data: buildNodeData(node.data as Record<string, unknown>, nextMedia) };
      })
    );
  };

  const uploadSingleFile = async (file: File) => {
    const kind = detectKind(file);
    if (!kind) {
      setError('不支持的文件类型');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const url = kind === 'image' ? await uploadImage(file) : await uploadFile(file);
      syncMedia({ kind, url, name: file.name, type: file.type });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadSingleFile(file);
    e.target.value = '';
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = Array.from(e.dataTransfer.files || [])[0];
    if (file) await uploadSingleFile(file);
  };

  useEffect(() => {
    setMedia(getMediaFromData((data || {}) as Record<string, unknown>));
  }, [data]);

  return (
    <div className="group">
      <div className="mb-2 ml-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
        {media ? kindIcon[media.kind] : <Upload size={12} />}
        <span>{label}</span>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100 p-2 w-72 relative transition-all duration-300 hover:shadow-3xl hover:border-blue-100">
        <div
          className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group/preview"
          onClick={() => {
            if (!uploading && !media) {
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {renderPreview(media)}

          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 z-10">
              <div className="bg-white/90 p-3 rounded-full shadow-lg">
                <Loader2 size={22} className="text-gray-700 animate-spin" />
              </div>
              <span className="text-white text-xs font-medium drop-shadow">上传中...</span>
            </div>
          )}

          {!uploading && !media && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex flex-col items-center justify-center gap-2 text-gray-400">
              <div className="bg-white/90 p-2 rounded-full shadow-lg">
                <Upload size={18} className="text-gray-700" />
              </div>
              <span className="text-[11px] font-semibold">拖入一个文件</span>
            </div>
          )}

          {media && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                syncMedia(null);
              }}
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow text-gray-500 hover:text-gray-700 opacity-0 group-hover/preview:opacity-100 transition-opacity"
              title="移除当前素材"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mt-2 px-1 flex items-center justify-between gap-2">
          <div className="text-[10px] text-gray-400 truncate">
            {media?.name || (media ? media.url : '图片 / 视频 / 音频，一个节点一个素材')}
          </div>
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-[11px] font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Upload size={12} />
            <span>{media ? '替换' : '上传'}</span>
          </button>
        </div>

        {error && <p className="text-red-500 text-[10px] mt-1.5 px-1 truncate">{error}</p>}

        <input
          ref={inputRef}
          type="file"
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

function renderPreview(media: ReferenceMedia | null) {
  if (!media) {
    return (
      <img
        src={DEFAULT_IMAGE}
        alt="Reference placeholder"
        className="w-full h-full object-cover opacity-40"
      />
    );
  }

  if (media.kind === 'image') {
    return (
      <img
        src={media.url}
        alt="Reference"
        className="w-full h-full object-cover"
      />
    );
  }

  if (media.kind === 'video') {
    return (
      <video
        src={media.url}
        className="w-full h-full object-cover"
        controls
        playsInline
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center mb-3 text-gray-500">
        <Music2 size={24} />
      </div>
      <audio src={media.url} controls className="w-full h-9 opacity-70 hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default ImageInputNode;
