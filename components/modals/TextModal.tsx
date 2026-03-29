'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TextModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange?: (newContent: string) => void;
  title?: string;
}

const TextModal: React.FC<TextModalProps> = ({
  isOpen,
  onClose,
  content,
  onContentChange,
  title = '文本内容'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (onContentChange) {
      onContentChange(editedContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      alert('内容已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'generated-text.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 sm:p-6 md:p-8">
      <div className="bg-white shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col rounded-3xl overflow-hidden border border-white/20">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center space-x-2">
            {isEditing && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-full border border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-800 transition-all duration-200 shadow-sm"
              >
                {showPreview ? '返回编辑' : '预览效果'}
              </button>
            )}
            {!isEditing && onContentChange && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-1.5 text-sm bg-sky-50 text-sky-600 rounded-full border border-sky-100 hover:bg-sky-100 hover:border-sky-200 hover:text-sky-700 transition-all duration-200 shadow-sm"
              >
                编辑
              </button>
            )}
            <button
              onClick={handleCopy}
              className="px-4 py-1.5 text-sm bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 hover:text-emerald-700 transition-all duration-200 shadow-sm"
            >
              复制
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-1.5 text-sm bg-violet-50 text-violet-600 rounded-full border border-violet-100 hover:bg-violet-100 hover:border-violet-200 hover:text-violet-700 transition-all duration-200 shadow-sm"
            >
              导出
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {isEditing ? (
            <div className="h-full flex flex-col">
              {showPreview ? (
                <div className="flex-1 overflow-auto bg-white rounded border border-gray-200 p-6">
                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-3xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-2xl font-bold text-gray-800 mb-3 mt-6">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">{children}</h3>,
                        p: ({ children }) => <p className="text-gray-700 leading-relaxed mb-4">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-gray-700">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        code: ({ children }) => <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                        pre: ({ children }) => <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 mb-4">{children}</blockquote>,
                        a: ({ children, href }) => <a href={href} className="text-blue-600 hover:underline">{children}</a>,
                        strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                      }}
                    >
                      {editedContent}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="flex-1 w-full p-4 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="在此编辑文本内容..."
                />
              )}
              <div className="flex justify-end space-x-2 mt-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto bg-white rounded border border-gray-200 p-6">
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-3xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-2xl font-bold text-gray-800 mb-3 mt-6">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">{children}</h3>,
                    p: ({ children }) => <p className="text-gray-700 leading-relaxed mb-4">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-gray-700">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    code: ({ children }) => <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                    pre: ({ children }) => <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 mb-4">{children}</blockquote>,
                    a: ({ children, href }) => <a href={href} className="text-blue-600 hover:underline">{children}</a>,
                    strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                    em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between text-xs text-gray-500">
            <span>字符数: {content.length}</span>
            <span>字数: {content.trim().split(/\s+/).filter(word => word.length > 0).length}</span>
            <span>行数: {content.split('\n').length}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TextModal;
