'use client';

import React, { useCallback } from 'react';
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

const FlowCanvas: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: string, label: string) => {
    const base = {
      id: `${nodes.length + 1}`,
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
    } as Partial<Node>;

    let data: any = { label, prompt: '' };
    if (type === 'textNode') {
      data = { label, prompt: '', output: '' };
    }
    if (type === 'imageNode') {
      data = { label, prompt: '', imageUrl: '', isLoading: false };
    }
    if (type === 'videoNode') {
      data = { label, prompt: '', videoUrl: '', isLoading: false };
    }
    if (type === 'audioNode') {
      data = { label, prompt: '', audioUrl: '', output: '', isLoading: false };
    }
    if (type === 'musicNode') {
      data = { label, prompt: '', musicUrl: '', isLoading: false };
    }
    if (type === 'unifiedNode') {
      data = { label, type: 'text', prompt: '', model: 'gpt-5-mini', count: 1, duration: 5, voice: 'zh_male_sunny', output: null, isLoading: false };
    }
    if (type === 'textInputNode') {
      data = { label, text: '' };
    }
    if (type === 'imageInputNode') {
      data = { label, imageUrl: '' };
    }

    const newNode: Node = {
      ...(base as Node),
      data,
      ...(type === 'textInputNode' ? { style: { width: 288, height: 120 } } : {}),
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden">
      <Toolbar onAddNode={addNode} />
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

export default FlowCanvas;
