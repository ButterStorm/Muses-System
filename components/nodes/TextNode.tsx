'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Maximize2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TextModal from '../modals/TextModal';

interface TextNodeData {
  label: string;
  prompt: string;
  output: string;
}

const TextNode = ({ data, id, selected }: NodeProps) => {
  const nodeData = data as unknown as TextNodeData;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [output, setOutput] = useState(nodeData.output);

  const handleContentChange = (newContent: string) => {
    setOutput(newContent);
    if (data.onChange) {
      data.onChange(id, { ...nodeData, output: newContent });
    }
  };

  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        minWidth={200}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="h-2 w-2 bg-white border border-blue-400 rounded-full"
      />

      <div className="absolute -top-6 left-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest pointer-events-none transition-opacity group-hover:opacity-100 opacity-60">
        文本生成结果
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-blue-100 p-4 h-full w-full relative transition-all duration-300 hover:shadow-2xl hover:border-blue-200 flex flex-col overflow-hidden">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-blue-300 !border-0"
        />

        <div className="relative flex-1 overflow-hidden">
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed overflow-y-auto h-full custom-scrollbar nodrag">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold text-gray-800 mb-2 mt-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-gray-800 mb-1 mt-2">{children}</h3>,
                p: ({ children }) => <p className="text-gray-700 leading-relaxed mb-2 text-sm">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 text-gray-700 text-sm">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 text-gray-700 text-sm">{children}</ol>,
                li: ({ children }) => <li className="ml-1">{children}</li>,
                code: ({ children }) => <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                pre: ({ children }) => <pre className="bg-gray-900 text-gray-100 p-2 rounded-lg overflow-x-auto mb-2 text-xs">{children}</pre>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-500 pl-2 italic text-gray-600 mb-2 text-sm">{children}</blockquote>,
                a: ({ children, href }) => <a href={href} className="text-blue-600 hover:underline text-sm">{children}</a>,
                strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
              }}
            >
              {output || '*等待生成...*'}
            </ReactMarkdown>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-1.5 shadow-sm hover:bg-white hover:shadow-md"
          >
            <Maximize2 size={14} className="text-gray-400 hover:text-blue-500" />
          </button>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-blue-300 !border-0"
        />
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

      <TextModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={output}
        onContentChange={handleContentChange}
        title="生成文本内容"
      />
    </div>
  );
};

export default TextNode;
