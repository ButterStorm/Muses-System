'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  Node,
  Edge,
  Connection,
  ConnectionMode,
  Controls,
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
import Toolbar from './Toolbar';
import AgentPanel from './AgentPanel';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

// 撤销/重做历史管理
interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

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

const initialNodes: Node[] = [
  {
    id: 'input-text',
    type: 'textInputNode',
    position: { x: 50, y: 300 },
    style: { width: 288, height: 120 },
    data: { label: '文本输入', text: '你好！请帮我写一段关于极简主义家居设计的描述。' },
  },
  {
    id: 'gen-1',
    type: 'unifiedNode',
    position: { x: 450, y: 300 },
    data: {
      label: '文生文',
      type: 'text',
      prompt: '',
      model: 'gpt-5-mini',
      count: 1,
      duration: 10,
      voice: 'male-qn-qingse',
      output: null,
      isLoading: false
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e2', source: 'input-text', target: 'gen-1', animated: true, style: { strokeWidth: 2, stroke: '#e2e8f0' } },
];

interface FlowCanvasProps {
  projectId?: string;
}

// 内部组件 — 在 ReactFlowProvider 内部，可以使用 useReactFlow
const FlowInner: React.FC<FlowCanvasProps> = ({ projectId }) => {
  // 有 projectId = 打开已保存项目，用空数组避免默认节点覆盖存储数据
  const [nodes, setNodes, onNodesChange] = useNodesState(projectId ? [] : initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(projectId ? [] : initialEdges);
  const { fitView, getViewport, deleteElements, getNodes, getEdges } = useReactFlow();

  const { currentProject, setCurrentProject, setDirty, loadProject, createProject, saveProject, renameProject } = useProjectStore();
  const { user } = useAuthStore();
  const loadedRef = useRef<string | null>(null);
  const clipboardRef = useRef<Node[]>([]);

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
      const newEntry: HistoryEntry = {
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        edges: JSON.parse(JSON.stringify(currentEdges)),
      };
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
      setNodes(JSON.parse(JSON.stringify(entry.nodes)));
      setEdges(JSON.parse(JSON.stringify(entry.edges)));
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
      setNodes(JSON.parse(JSON.stringify(entry.nodes)));
      setEdges(JSON.parse(JSON.stringify(entry.edges)));
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
          clipboardRef.current = JSON.parse(JSON.stringify(selected));
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
            ...JSON.parse(JSON.stringify(n)),
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
          setEdges(flowData.edges || []);
          requestAnimationFrame(() => fitView({ duration: 300 }));
        }
      });
    } else if (!projectId) {
      loadedRef.current = null;
      setCurrentProject(null);
    }
  }, [projectId]);

  // 标记脏状态 + 推送历史快照
  useEffect(() => {
    if (isUndoRedoRef.current) return;
    if (currentProject) {
      setDirty(true);
    }
    pushHistory(nodes, edges);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: string, label: string) => {
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
      position: { x: cx, y: cy },
    } as Partial<Node>;

    let data: any = { label, prompt: '' };
    if (type === 'textNode') data = { label, prompt: '', output: '' };
    if (type === 'imageNode') data = { label, prompt: '', imageUrl: '', isLoading: false };
    if (type === 'videoNode') data = { label, prompt: '', videoUrl: '', isLoading: false };
    if (type === 'audioNode') data = { label, prompt: '', audioUrl: '', output: '', isLoading: false };
    if (type === 'musicNode') data = { label, prompt: '', musicUrl: '', isLoading: false };
    if (type === 'unifiedNode') data = { label, type: 'text', prompt: '', model: 'gpt-5-mini', count: 1, duration: 5, voice: 'zh_male_sunny', output: null, isLoading: false };
    if (type === 'textInputNode') data = { label, text: '' };
    if (type === 'imageInputNode') data = { label, imageUrl: '' };

    const newNode: Node = {
      ...(base as Node),
      data,
      ...(type === 'textInputNode' ? { style: { width: 288, height: 120 } } : {}),
      ...(type === 'textNode' ? { style: { width: 288, height: 150 } } : {}),
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!currentProject) {
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
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden">
      <Toolbar onAddNode={addNode} onSave={handleSave} projectName={currentProject?.name} onRename={(name) => renameProject(currentProject!.id, name)} />
      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            className="bg-gray-50"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#aaa" gap={16} />
            <Controls position="top-right" />
          </ReactFlow>
        </div>
        <AgentPanel />
      </div>
    </div>
  );
};

// 外层组件 — 提供 ReactFlowProvider
const FlowCanvas: React.FC<FlowCanvasProps> = ({ projectId }) => {
  return (
    <ReactFlowProvider>
      <FlowInner projectId={projectId} />
    </ReactFlowProvider>
  );
};

export default FlowCanvas;
