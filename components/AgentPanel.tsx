'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Bot, Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AgentPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 Muses AI 助手。我可以帮你：\n\n• 解答使用问题\n• 提供创作灵感\n• 协助优化提示词\n\n有什么可以帮你的吗？',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 打开面板时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const history = messages
      .filter((message) => message.id !== 'welcome')
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          model: 'openai:gpt-4o',
          history,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || '无响应',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Agent API error:', error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : '抱歉，服务暂时不可用，请稍后重试。';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: fallbackMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 格式化消息内容（简单的换行处理）
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <>
      {/* Toggle Button - 保持原始贴边设计 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-4 right-4 z-50
                     md:top-1/2 md:right-0 md:bottom-auto md:-translate-y-1/2
                     bg-gradient-to-r from-gray-800 to-gray-900
                     text-white p-3 md:pl-4 rounded-xl md:rounded-l-xl md:rounded-r-none
                     shadow-lg hover:shadow-xl hover:scale-105 transition-all group"
          title="Open Agent"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <span className="font-medium text-sm">Agent</span>
          </div>
        </button>
      )}

      {/* Panel - 保持原始布局结构，但使用柔和配色 */}
      <div
        className={`absolute inset-x-0 bottom-0 z-50 h-[min(80vh,640px)] w-full rounded-t-2xl border-t border-gray-200/60 bg-white/95 backdrop-blur-xl shadow-2xl transition-all duration-300 ease-in-out flex flex-col
                    md:static md:h-full md:rounded-none md:border-t-0 md:border-l md:bg-white/90 md:flex-shrink-0 md:translate-y-0
                    ${isOpen ? 'translate-y-0 md:w-[380px]' : 'translate-y-full md:w-0'}`}
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header - 柔和深灰渐变 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100
                        bg-gradient-to-r from-gray-800 to-gray-900 text-white">
          <div className="flex items-center gap-2">
            <Bot size={22} />
            <span className="font-semibold">Muses AI 助手</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages - 柔和配色 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/80">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gray-800 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 shadow-sm'
                }`}
              >
                {formatContent(msg.content)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2 border border-gray-200 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-500">思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - 简洁柔和 */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm
                         text-gray-700 placeholder:text-gray-400
                         focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10
                         transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className={`px-3 py-2 rounded-xl transition-all
                         ${input.trim() && !isLoading
                           ? 'bg-black text-white hover:bg-gray-900 shadow-md'
                           : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                         }`}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AgentPanel;
