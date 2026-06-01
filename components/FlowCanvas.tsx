'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  Node,
  Edge,
  Connection,
  ConnectionLineType,
  ConnectionMode,
  Background,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TextNode from './nodes/TextNode';
import ImageNode from './nodes/ImageNode';
import VideoNode from './nodes/VideoNode';
import AudioNode from './nodes/AudioNode';
import MusicNode from './nodes/MusicNode';
import UnifiedGeneratorNode from './nodes/UnifiedGeneratorNode';
import TextInputNode from './nodes/TextInputNode';
import ImageInputNode from './nodes/ImageInputNode';
import Toolbar, { ViewMode } from './Toolbar';
import CanvasFloatingPanel from './CanvasFloatingPanel';
import AgentPanel from './AgentPanel';
import SandboxFilesPanel from './SandboxFilesPanel';
import Galaxy from './Galaxy';
import ErrorBoundary from './ErrorBoundary';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { cloneFlowState, cloneNodes } from '@/lib/flowHistory';
import { getDefaultModel } from '@/lib/modelCatalog';
import { uploadFile, uploadImage } from '@/lib/storage';
import { toast } from 'sonner';

// 撤销/重做历史管理
interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

type ReferenceKind = 'image' | 'video' | 'audio';

const MAX_HISTORY = 50;

const nodeTypes = {
  textNode: TextNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  audioNode: AudioNode,
  musicNode: MusicNode,
  unifiedNode: UnifiedGeneratorNode,
  textInputNode: TextInputNode,
  imageInputNode: ImageInputNode,
};

const defaultEdgeOptions: Partial<Edge> = {
  type: 'smoothstep',
  animated: true,
  style: { strokeWidth: 2, stroke: '#94a3b8' },
};

function normalizeEdge(edge: Edge): Edge {
  return {
    ...edge,
    type: edge.type || defaultEdgeOptions.type,
    animated: edge.animated ?? defaultEdgeOptions.animated,
    style: {
      ...(defaultEdgeOptions.style || {}),
      ...(edge.style || {}),
    },
  };
}

function normalizeEdges(edges: Edge[]): Edge[] {
  return edges.map(normalizeEdge);
}

function detectReferenceKind(file: File): ReferenceKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

function getReferenceNodeData(kind: ReferenceKind, url: string, file: File): Record<string, unknown> {
  return {
    label: kind === 'image' ? '图片参考' : kind === 'video' ? '视频参考' : '音频参考',
    mediaKind: kind,
    mediaUrl: url,
    mediaName: file.name,
    mediaType: file.type,
    imageUrl: kind === 'image' ? url : '',
    videoUrl: kind === 'video' ? url : '',
    audioUrl: kind === 'audio' ? url : '',
    imageUrls: kind === 'image' ? [url] : [],
    videoUrls: kind === 'video' ? [url] : [],
    audioUrls: kind === 'audio' ? [url] : [],
    videoFiles: kind === 'video' ? [{ url, name: file.name, type: file.type }] : [],
    audioFiles: kind === 'audio' ? [{ url, name: file.name, type: file.type }] : [],
  };
}

const initialNodes: Node[] = [
  {
    id: 'input-text',
    type: 'textInputNode',
    position: { x: 220, y: 260 },
    style: { width: 240, height: 96 },
    data: { label: '文本输入', text: '你好！请帮我写一段关于极简主义家居设计的描述。' },
  },
  {
    id: 'gen-1',
    type: 'unifiedNode',
    position: { x: 560, y: 240 },
    data: {
      label: '文生文',
      type: 'text',
      prompt: '',
      model: getDefaultModel('text'),
      count: 1,
      duration: 10,
      voice: 'male-qn-qingse',
      output: null,
      isLoading: false
    },
  },
];

const initialEdges: Edge[] = [
  normalizeEdge({ id: 'e2', source: 'input-text', target: 'gen-1', style: { strokeWidth: 2, stroke: '#e2e8f0' } }),
];

interface FlowCanvasProps {
  projectId?: string;
}

// 内部组件 — 在 ReactFlowProvider 内部，可以使用 useReactFlow
const FlowInner: React.FC<FlowCanvasProps> = ({ projectId }) => {
  // 有 projectId = 打开已保存项目，用空数组避免默认节点覆盖存储数据
  const [nodes, setNodes, onNodesChange] = useNodesState(projectId ? [] : initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(projectId ? [] : initialEdges);
  const { fitView, getViewport, screenToFlowPosition, deleteElements, getNodes, getEdges } = useReactFlow();

  const { currentProject, setCurrentProject, setDirty, loadProject, createProject, saveProject, renameProject } = useProjectStore();
  const { user } = useAuthStore();
  const loadedRef = useRef<string | null>(null);
  const clipboardRef = useRef<Node[]>([]);
  const saveLockRef = useRef(false);

  // 撤销/重做状态
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);
  const lastSnapshotTime = useRef(0);

  // 创建历史快照（节流：至少间隔 500ms）
  const pushHistory = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    const now = Date.now();
    if (now - lastSnapshotTime.current < 500) return;
    lastSnapshotTime.current = now;

    setHistory(prev => {
      // 截断 redo 部分
      const truncated = prev.slice(0, historyIndex + 1);
      const newEntry = cloneFlowState(currentNodes, currentEdges);
      const updated = [...truncated, newEntry];
      // 限制历史长度
      if (updated.length > MAX_HISTORY) updated.shift();
      return updated;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  // 撤销
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    isUndoRedoRef.current = true;
    const newIndex = historyIndex - 1;
    const entry = history[newIndex];
    if (entry) {
      const cloned = cloneFlowState(entry.nodes, entry.edges);
      setNodes(cloned.nodes);
      setEdges(cloned.edges);
      setHistoryIndex(newIndex);
    }
    setTimeout(() => { isUndoRedoRef.current = false; }, 100);
  }, [history, historyIndex, setNodes, setEdges]);

  // 重做
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    isUndoRedoRef.current = true;
    const newIndex = historyIndex + 1;
    const entry = history[newIndex];
    if (entry) {
      const cloned = cloneFlowState(entry.nodes, entry.edges);
      setNodes(cloned.nodes);
      setEdges(cloned.edges);
      setHistoryIndex(newIndex);
    }
    setTimeout(() => { isUndoRedoRef.current = false; }, 100);
  }, [history, historyIndex, setNodes, setEdges]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z 撤销
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+S 保存
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        handleSave();
        toast.success('项目已保存');
        return;
      }

      // Delete 删除选中节点
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 不在输入框中才删除
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        const selectedNodes = getNodes().filter(n => n.selected);
        const selectedEdges = getEdges().filter(e => e.selected);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          pushHistory(getNodes(), getEdges());
          deleteElements({ nodes: selectedNodes, edges: selectedEdges });
        }
      }

      // Ctrl+C 复制选中节点
      if (isCtrl && e.key === 'c') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        const selected = getNodes().filter(n => n.selected);
        if (selected.length > 0) {
          clipboardRef.current = cloneNodes(selected);
          toast.success(`已复制 ${selected.length} 个节点`);
        }
      }

      // Ctrl+V 粘贴节点
      if (isCtrl && e.key === 'v') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        const copied = clipboardRef.current;
        if (copied.length === 0) return;
        pushHistory(getNodes(), getEdges());
        const idMap = new Map<string, string>();
        const newNodes = copied.map(n => {
          const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          idMap.set(n.id, newId);
          return {
            ...cloneNodes([n])[0],
            id: newId,
            position: { x: n.position.x + 40, y: n.position.y + 40 },
            selected: false,
          };
        });
        setNodes(nds => [...nds, ...newNodes]);
        toast.success(`已粘贴 ${newNodes.length} 个节点`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, getNodes, getEdges, deleteElements, pushHistory]);

  // 加载已有项目
  useEffect(() => {
    if (projectId && loadedRef.current !== projectId) {
      loadedRef.current = projectId;
      loadProject(projectId).then((flowData) => {
        if (flowData && flowData.nodes && flowData.nodes.length > 0) {
          setNodes(flowData.nodes);
          setEdges(normalizeEdges(flowData.edges || []));
          requestAnimationFrame(() => fitView({ duration: 300 }));
        }
      });
    } else if (!projectId) {
      loadedRef.current = null;
      setCurrentProject(null);
    }
  }, [projectId]);

  useEffect(() => {
    setEdges((currentEdges) => {
      const needsNormalization = currentEdges.some((edge) => !edge.type);
      return needsNormalization ? normalizeEdges(currentEdges) : currentEdges;
    });
  }, [setEdges]);

  // 标记脏状态 + 推送历史快照
  useEffect(() => {
    if (isUndoRedoRef.current) return;
    if (currentProject) {
      setDirty(true);
    }
    pushHistory(nodes, edges);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const addNode = (type: string, label: string, initialData: Record<string, unknown> = {}, position?: { x: number; y: number }) => {
    // Calculate canvas center of current viewport
    const { x: vx, y: vy, zoom } = getViewport();
    const container = document.querySelector('.react-flow') as HTMLElement;
    const cw = container ? container.clientWidth / 2 : 400;
    const ch = container ? container.clientHeight / 2 : 300;
    const cx = (-vx + cw) / zoom;
    const cy = (-vy + ch) / zoom;

    const base = {
      id: `node-${Date.now()}`,
      type,
      position: position || { x: cx, y: cy },
    } as Partial<Node>;

    let data: any = { label, prompt: '', ...initialData };
    if (type === 'textNode') data = { label, prompt: '', output: '', ...initialData };
    if (type === 'imageNode') data = { label, prompt: '', imageUrl: '', isLoading: false, ...initialData };
    if (type === 'videoNode') data = { label, prompt: '', videoUrl: '', isLoading: false, ...initialData };
    if (type === 'audioNode') data = { label, prompt: '', audioUrl: '', output: '', isLoading: false, ...initialData };
    if (type === 'musicNode') data = { label, prompt: '', musicUrl: '', isLoading: false, ...initialData };
    if (type === 'unifiedNode') data = { label, type: 'text', prompt: '', model: getDefaultModel('text'), count: 1, duration: 5, voice: 'zh_male_sunny', output: null, isLoading: false, ...initialData };
    if (type === 'textInputNode') data = { label, text: '', ...initialData };
    if (type === 'imageInputNode') data = { label, mediaKind: '', mediaUrl: '', mediaName: '', mediaType: '', imageUrls: [], videoUrls: [], audioUrls: [], imageUrl: '', videoUrl: '', audioUrl: '', videoFiles: [], audioFiles: [], ...initialData };

    const newNode: Node = {
      ...(base as Node),
      data,
      ...(type === 'textInputNode' ? { style: { width: 288, height: initialData.text ? 180 : 120 } } : {}),
      ...(type === 'textNode' ? { style: { width: 288, height: 150 } } : {}),
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleCanvasDrop = useCallback(async (event: React.DragEvent) => {
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;

    event.preventDefault();

    const supportedFiles = files
      .map((file) => ({ file, kind: detectReferenceKind(file) }))
      .filter((item): item is { file: File; kind: ReferenceKind } => !!item.kind);

    if (supportedFiles.length === 0) {
      toast.error('请拖入图片、视频或音频文件');
      return;
    }

    pushHistory(getNodes(), getEdges());

    const dropPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const uploadingToast = toast.loading(`正在上传 ${supportedFiles.length} 个参考素材...`);

    try {
      const createdNodes: Node[] = [];
      for (let index = 0; index < supportedFiles.length; index++) {
        const { file, kind } = supportedFiles[index];
        const url = kind === 'image' ? await uploadImage(file) : await uploadFile(file);
        createdNodes.push({
          id: `ref-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'imageInputNode',
          position: {
            x: dropPosition.x + (index % 3) * 320,
            y: dropPosition.y + Math.floor(index / 3) * 260,
          },
          data: getReferenceNodeData(kind, url, file),
        });
      }

      setNodes((nds) => [...nds, ...createdNodes]);
      toast.success(`已添加 ${createdNodes.length} 个参考节点`, { id: uploadingToast });
    } catch (error) {
      console.error('[Canvas Drop] 上传失败:', error);
      toast.error(error instanceof Error ? error.message : '上传失败', { id: uploadingToast });
    }
  }, [getEdges, getNodes, pushHistory, screenToFlowPosition, setNodes]);

  const handleSave = async () => {
    if (!user || saveLockRef.current) return;

    saveLockRef.current = true;
    try {
      const latestProject = useProjectStore.getState().currentProject;
      if (!latestProject) {
        await createProject(user.id);
      }

      const flowData = {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          style: {
            ...node.style,
            ...(node.width ? { width: node.width } : {}),
            ...(node.height ? { height: node.height } : {}),
          },
          data: node.data,
        })),
        edges: edges.map(({ id, source, target, sourceHandle, targetHandle, type, animated, style }) => ({
          id, source, target, sourceHandle, targetHandle, type, animated, style,
        })),
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      await saveProject(flowData);
    } finally {
      saveLockRef.current = false;
    }
  };

  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden">
      <Toolbar onSave={handleSave} projectName={currentProject?.name} onRename={(name) => renameProject(currentProject!.id, name)} viewMode={viewMode} onViewModeChange={setViewMode} />
      <div className="flex-1 flex relative overflow-hidden">
        {/* 3D 翻转容器 */}
        <div className="flex-1 h-full" style={{ perspective: 1200 }}>
          {/* 正面 - 画布 */}
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              transform: viewMode === 'canvas' ? 'rotateY(0deg)' : 'rotateY(-180deg)',
              transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Strict}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 2 }}
              defaultEdgeOptions={defaultEdgeOptions}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
              fitView
              fitViewOptions={{ padding: 0.35, maxZoom: 0.85 }}
              className="bg-gray-50"
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#aaa" gap={16} />
            </ReactFlow>
            {viewMode === 'canvas' && (
              <>
                <CanvasFloatingPanel onAddNode={addNode} />
                <SandboxFilesPanel />
              </>
            )}
          </div>

          {/* 背面 - 空间 */}
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              transform: viewMode === 'space' ? 'rotateY(0deg)' : 'rotateY(180deg)',
              transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
            }}
          >
            {viewMode === 'space' && (
              <Galaxy
                hueShift={160}
                density={1.2}
                starSpeed={0.4}
                speed={0.8}
                glowIntensity={0.4}
                twinkleIntensity={0.5}
                rotationSpeed={0.05}
                transparent={false}
              />
            )}
          </div>
        </div>
        <AgentPanel projectId={projectId || currentProject?.id} />
      </div>
    </div>
  );
};

// 外层组件 — 提供 ReactFlowProvider
const FlowCanvas: React.FC<FlowCanvasProps> = ({ projectId }) => {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <FlowInner projectId={projectId} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
};

export default FlowCanvas;
