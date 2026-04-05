'use client';

import React, { useCallback, useEffect, useRef } from 'react';
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
  const { fitView, getViewport } = useReactFlow();

  const { currentProject, setCurrentProject, setDirty, loadProject, createProject, saveProject, renameProject } = useProjectStore();
  const { user } = useAuthStore();
  const loadedRef = useRef<string | null>(null);

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

  // 标记脏状态
  useEffect(() => {
    if (currentProject) {
      setDirty(true);
    }
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
      nodes: nodes.map(({ data, id, position, type, style }) => ({
        id, type, position, style, data,
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
