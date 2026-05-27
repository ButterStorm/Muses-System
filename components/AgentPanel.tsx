'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Bot, Send, Sparkles, Activity, CheckCircle2, CircleAlert, Wrench, ChevronDown, ChevronRight, Power, Square, RefreshCw, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { agentService } from '@/services/agentService';
import { useAuthStore } from '@/stores/authStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentPanelProps {
  projectId?: string;
}

type RunEventStatus = 'active' | 'done' | 'error' | 'info';

interface RunEvent {
  id: string;
  label: string;
  detail?: string;
  status: RunEventStatus;
  timestamp: Date;
  toolName?: string;
}

const AgentPanel: React.FC<AgentPanelProps> = ({ projectId }) => {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([createWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningRuntime, setIsOpeningRuntime] = useState(false);
  const [isClosingRuntime, setIsClosingRuntime] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [isSandboxActive, setIsSandboxActive] = useState(false);
  const [sandboxConfirmAction, setSandboxConfirmAction] = useState<'open' | 'close' | null>(null);
  const [sandboxPowerError, setSandboxPowerError] = useState('');
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [runAnchorMessageId, setRunAnchorMessageId] = useState<string | null>(null);
  const [isRunTraceExpanded, setIsRunTraceExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runtimeIdRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const isTerminatingRef = useRef(false);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, runEvents]);

  // 打开面板时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (user?.id) {
      runtimeIdRef.current = `user:${user.id}`;
      return;
    }

    if (projectId) {
      runtimeIdRef.current = `anonymous-project:${projectId}`;
      return;
    }

    const storageKey = 'muses-agent-runtime-id';
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      runtimeIdRef.current = existing;
      return;
    }

    const nextId = `local:${createRuntimeId()}`;
    window.localStorage.setItem(storageKey, nextId);
    runtimeIdRef.current = nextId;
  }, [projectId, user?.id]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isClosingRuntime) return;

    const messageTime = Date.now();
    const assistantId = `${messageTime}:assistant`;
    const userMessage: Message = {
      id: `${messageTime}:user`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const assistantPlaceholder: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setIsLoading(true);
    activeAssistantIdRef.current = assistantId;
    isTerminatingRef.current = false;
    setRunAnchorMessageId(assistantId);
    setIsRunTraceExpanded(false);
    setRunEvents([
      createRunEvent('收到任务', truncateForTrace(userMessage.content), 'done'),
      createRunEvent('连接 Agent runtime', '准备复用当前会话和工具上下文', 'active'),
    ]);

    try {
      ensureRuntimeId(runtimeIdRef);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const finalContent = await agentService.streamMessage(userMessage.content, {
        runtimeId: runtimeIdRef.current,
        model: 'deepseek:deepseek-v4-flash',
        signal: abortController.signal,
        onRuntime: (runtime) => {
          setRunEvents(prev => [
            ...markLastActiveDone(prev),
            createRunEvent('SSE 通道已连接', `${runtime.runtimeId} · ${runtime.model || 'default model'}`, 'done'),
          ]);
        },
        onStatus: (status) => {
          if (isSandboxStartedStatus(status.label)) {
            setIsSandboxActive(true);
          }
          setRunEvents(prev => [
            ...markLastActiveDone(prev),
            createRunEvent(status.label, status.detail, status.status || 'info'),
          ]);
        },
        onDelta: (text) => {
          setMessages(prev => prev.map((message) => (
            message.id === assistantId
              ? { ...message, content: `${message.content}${text}` }
              : message
          )));
        },
        onTool: (tool) => {
          setRunEvents(prev => upsertToolRunEvent(markLastActiveDone(prev), tool));
        },
        onDone: () => {
          setRunEvents(prev => [
            ...markLastActiveDone(prev),
            createRunEvent('生成完成', '回答已写入对话', 'done'),
          ]);
        },
      });

      if (isTerminatingRef.current) return;

      setMessages(prev => prev.map((message) => (
        message.id === assistantId && !message.content
          ? { ...message, content: finalContent || '无响应' }
          : message
      )));
    } catch (error) {
      if (isAbortError(error) || isTerminatingRef.current) {
        return;
      }

      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : '抱歉，服务暂时不可用，请稍后重试。';
      setRunEvents(prev => [
        ...markLastActiveDone(prev),
        createRunEvent('运行失败', fallbackMessage, 'error'),
      ]);
      setMessages(prev => prev.map((message) => (
        message.id === assistantId
          ? { ...message, content: fallbackMessage }
          : message
      )));
    } finally {
      if (activeAssistantIdRef.current === assistantId) {
        activeAssistantIdRef.current = null;
      }
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const requestSandboxToggle = () => {
    if (isLoading || isOpeningRuntime || isClosingRuntime) return;
    setSandboxPowerError('');
    setSandboxConfirmAction(isSandboxActive ? 'close' : 'open');
  };

  const openRuntime = async () => {
    if (isOpeningRuntime || isClosingRuntime || isLoading) return;

    try {
      setIsOpeningRuntime(true);
      setSandboxPowerError('');
      ensureRuntimeId(runtimeIdRef);
      let didStartSandbox = false;
      await agentService.openRuntime({
        runtimeId: runtimeIdRef.current,
        model: 'deepseek:deepseek-v4-flash',
        onStatus: (status) => {
          if (isSandboxStartedStatus(status.label)) {
            didStartSandbox = true;
            setIsSandboxActive(true);
          }
        },
      });
      if (didStartSandbox) {
        setIsSandboxActive(true);
        setSandboxConfirmAction(null);
      } else {
        setIsSandboxActive(false);
        setSandboxPowerError('沙箱没有真正启动，请检查 E2B 配置或启动日志');
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '开启沙盒失败';
      setSandboxPowerError(message);
    } finally {
      setIsOpeningRuntime(false);
    }
  };

  const closeRuntime = async () => {
    if (isClosingRuntime || isLoading) return;

    try {
      setIsClosingRuntime(true);
      setSandboxPowerError('');
      setSandboxConfirmAction(null);
      ensureRuntimeId(runtimeIdRef);
      await agentService.closeRuntime(runtimeIdRef.current);
      setIsSandboxActive(false);
      setRunAnchorMessageId(prev => prev || 'welcome');
      setRunEvents(prev => [
        ...markLastActiveDone(prev),
        createRunEvent('沙箱已关闭', '已 kill 当前用户的 E2B 沙箱；左下角刷新只重置会话，不删除沙箱文件', 'done'),
      ]);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '关闭沙盒失败';
      setRunEvents(prev => [
        ...markLastActiveDone(prev),
        createRunEvent('关闭沙盒失败', message, 'error'),
      ]);
    } finally {
      setIsClosingRuntime(false);
    }
  };

  const terminateRun = async () => {
    if (!isLoading) return;

    isTerminatingRef.current = true;
    abortControllerRef.current?.abort();
    setIsLoading(false);

    const assistantId = activeAssistantIdRef.current;
    if (assistantId) {
      setMessages(prev => prev.map((message) => (
        message.id === assistantId && !message.content
          ? { ...message, content: '已终止运行。' }
          : message
      )));
    }

    setRunEvents(prev => [
      ...markLastActiveDone(prev),
      createRunEvent('运行已终止', '已停止当前 Agent 对话，沙盒保持可复用', 'done'),
    ]);
    activeAssistantIdRef.current = null;
    abortControllerRef.current = null;
  };

  const resetSession = async () => {
    if (isResettingSession) return;

    if (isLoading) {
      isTerminatingRef.current = true;
      abortControllerRef.current?.abort();
      setIsLoading(false);
      activeAssistantIdRef.current = null;
      abortControllerRef.current = null;
    }

    try {
      setIsResettingSession(true);
      ensureRuntimeId(runtimeIdRef);
      await agentService.resetRuntimeContext(runtimeIdRef.current);
    } catch {
      // A missing server-side runtime still results in a clean client-side conversation.
    } finally {
      setMessages([createWelcomeMessage()]);
      setInput('');
      setRunEvents([]);
      setRunAnchorMessageId(null);
      setIsRunTraceExpanded(false);
      isTerminatingRef.current = false;
      setIsResettingSession(false);
    }
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
          <div className="flex items-center gap-1">
            <button
              onClick={requestSandboxToggle}
              disabled={isLoading || isOpeningRuntime || isClosingRuntime}
              aria-pressed={isSandboxActive}
              className={`rounded-full p-1.5 transition-colors disabled:cursor-not-allowed ${
                isSandboxActive
                  ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/50 hover:bg-emerald-400/25 disabled:opacity-80'
                  : 'text-white hover:bg-white/20 disabled:opacity-40'
              }`}
              title={isSandboxActive ? '沙箱已启动，点击关闭' : '沙箱未启动，点击开启'}
            >
              <Power size={17} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
              title="关闭面板"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages - 柔和配色 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/80">
          {messages.map((msg) => {
            const isEmptyAssistantPlaceholder = msg.role === 'assistant' && msg.content.trim().length === 0;
            const shouldRenderRunTrace = msg.id === runAnchorMessageId && runEvents.length > 0;

            return (
              <React.Fragment key={msg.id}>
                {shouldRenderRunTrace && isLoading && (
                  <ThinkingIndicator />
                )}
                {shouldRenderRunTrace && (
                  <RunTrace
                    events={runEvents}
                    expanded={isRunTraceExpanded}
                    onToggle={() => setIsRunTraceExpanded(prev => !prev)}
                  />
                )}
                {!isEmptyAssistantPlaceholder && (
                  <div
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gray-800 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-200 shadow-sm'
                      }`}
                    >
                      <MarkdownMessage content={msg.content} role={msg.role} />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - 简洁柔和 */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex gap-2">
            <button
              onClick={resetSession}
              disabled={isResettingSession || isClosingRuntime}
              title="新建会话"
              className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} className={isResettingSession ? 'animate-spin' : undefined} />
            </button>
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
              onClick={isLoading ? terminateRun : sendMessage}
              disabled={!isLoading && (!input.trim() || isClosingRuntime)}
              title={isLoading ? '终止运行' : '发送'}
              className={`px-3 py-2 rounded-xl transition-all
                         ${isLoading
                           ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                           : input.trim() && !isClosingRuntime
                           ? 'bg-black text-white hover:bg-gray-900 shadow-md'
                           : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                         }`}
            >
              {isLoading ? <Square size={16} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
      {sandboxConfirmAction && (
        <SandboxPowerConfirmDialog
          action={sandboxConfirmAction}
          busy={isOpeningRuntime || isClosingRuntime}
          error={sandboxPowerError}
          onCancel={() => setSandboxConfirmAction(null)}
          onConfirm={sandboxConfirmAction === 'open' ? openRuntime : closeRuntime}
        />
      )}
    </>
  );
};

export default AgentPanel;

function ThinkingIndicator() {
  return (
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
  );
}

function RunTrace({
  events,
  expanded,
  onToggle,
}: {
  events: RunEvent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const latestEvent = events[events.length - 1];
  const hasActiveEvent = events.some((event) => event.status === 'active');
  const hasErrorEvent = events.some((event) => event.status === 'error');
  const summaryText = hasErrorEvent
    ? '运行失败'
    : hasActiveEvent
      ? latestEvent?.label || '运行中'
      : latestEvent?.label || `已完成 ${events.length} 步`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <Activity size={15} className="shrink-0 text-gray-900" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">运行过程</span>
              <span className={`h-1.5 w-1.5 rounded-full ${hasActiveEvent ? 'animate-pulse bg-blue-500' : hasErrorEvent ? 'bg-red-500' : 'bg-emerald-500'}`} />
            </div>
            <p className="truncate text-[11px] leading-4 text-gray-500">{summaryText}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          {expanded ? '收起' : `${events.length}步`}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {events.map((event) => (
            <div key={event.id} className="flex gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                <RunEventIcon status={event.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-gray-800">{event.label}</p>
                  <time className="shrink-0 text-[10px] text-gray-400">
                    {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </time>
                </div>
                {event.detail && (
                  <p className="mt-0.5 break-words text-[11px] leading-relaxed text-gray-500">
                    {event.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunEventIcon({ status }: { status: RunEventStatus }) {
  if (status === 'active') {
    return <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" />;
  }

  if (status === 'error') {
    return <CircleAlert size={15} className="text-red-500" />;
  }

  if (status === 'info') {
    return <Wrench size={14} className="text-gray-500" />;
  }

  return <CheckCircle2 size={15} className="text-emerald-500" />;
}

function SandboxPowerConfirmDialog({
  action,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  action: 'open' | 'close';
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isOpenAction = action === 'open';
  const title = busy && isOpenAction
    ? '正在开启沙箱...'
    : isOpenAction
      ? '是否确定开启沙箱？'
      : '是否确定关闭沙箱？';

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sandbox-power-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isOpenAction ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            <Power size={18} />
          </div>
          <div className="min-w-0">
            <h2 id="sandbox-power-dialog-title" className="text-sm font-semibold text-gray-900">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {busy && isOpenAction
                ? '正在创建 E2B 运行环境并配置 Skills，请稍等。'
                : isOpenAction
                ? '开启后会创建 E2B 运行环境，并配置 Skills。'
                : '关闭会直接 kill 当前用户的 E2B 沙箱。左下角刷新只重置会话，不删除沙箱文件。'}
            </p>
            {error && (
              <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs leading-5 text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isOpenAction ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy ? '处理中...' : isOpenAction ? '确认开启' : '确认关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkdownMessage({ content, role }: { content: string; role: 'user' | 'assistant' }) {
  const isUser = role === 'user';
  const textClass = isUser ? 'text-white' : 'text-gray-700';
  const mutedTextClass = isUser ? 'text-gray-100' : 'text-gray-600';
  const strongClass = isUser ? 'text-white' : 'text-gray-900';
  const codeClass = isUser
    ? 'bg-white/15 text-white'
    : 'bg-gray-100 text-rose-600';
  const preClass = isUser
    ? 'bg-black/25 text-gray-50'
    : 'bg-gray-900 text-gray-100';
  const linkClass = isUser
    ? 'text-indigo-100 underline decoration-white/50 underline-offset-2'
    : 'text-indigo-600 hover:underline';

  return (
    <div className={`agent-markdown max-w-none break-words ${textClass}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={`mb-2 text-base font-semibold ${strongClass}`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`mb-1.5 mt-2 text-sm font-semibold ${strongClass}`}>{children}</h2>,
          h3: ({ children }) => <h3 className={`mb-1 mt-2 text-sm font-semibold ${strongClass}`}>{children}</h3>,
          p: ({ children }) => <p className={`mb-3 whitespace-pre-wrap leading-7 last:mb-0 ${textClass}`}>{children}</p>,
          ul: ({ children }) => <ul className={`mb-3 list-disc space-y-1.5 pl-5 last:mb-0 ${textClass}`}>{children}</ul>,
          ol: ({ children }) => <ol className={`mb-3 list-decimal space-y-1.5 pl-5 last:mb-0 ${textClass}`}>{children}</ol>,
          li: ({ children }) => <li className="leading-6">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={`mb-2 border-l-2 pl-3 italic ${isUser ? 'border-white/40' : 'border-indigo-300'} ${mutedTextClass}`}>
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className={`rounded px-1 py-0.5 font-mono text-xs ${codeClass}`}>{children}</code>
          ),
          pre: ({ children }) => (
            <pre className={`mb-2 overflow-x-auto rounded-lg p-3 text-xs leading-relaxed ${preClass}`}>{children}</pre>
          ),
          a: ({ children, href }) => (
            isMediaUrl(href)
              ? <MediaPreview url={href || ''} alt={getTextFromChildren(children) || '媒体预览'} />
              : (
                <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
                  {children}
                </a>
              )
          ),
          img: ({ src, alt }) => (
            <MediaPreview url={src || ''} alt={alt || '图片预览'} />
          ),
          strong: ({ children }) => <strong className={`font-semibold ${strongClass}`}>{children}</strong>,
          em: ({ children }) => <em className={mutedTextClass}>{children}</em>,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`border px-2 py-1 font-semibold ${isUser ? 'border-white/20' : 'border-gray-200'}`}>{children}</th>
          ),
          td: ({ children }) => (
            <td className={`border px-2 py-1 ${isUser ? 'border-white/20' : 'border-gray-200'}`}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MediaPreview({ url, alt }: { url: string; alt: string }) {
  const kind = getMediaKind(url);
  if (!kind) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
        {url}
      </a>
    );
  }

  return (
    <span className="group/media relative my-2 block overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm">
      {kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className="block max-h-72 w-full object-contain"
          loading="lazy"
        />
      ) : (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="block max-h-72 w-full bg-black"
        />
      )}
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          downloadMedia(url, kind);
        }}
        className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white opacity-95 shadow-lg backdrop-blur transition-all hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/80"
        title={kind === 'image' ? '下载图片' : '下载视频'}
        aria-label={kind === 'image' ? '下载图片' : '下载视频'}
      >
        <Download size={15} />
      </button>
    </span>
  );
}

function isMediaUrl(value?: string): boolean {
  return Boolean(value && getMediaKind(value));
}

function getMediaKind(value: string): 'image' | 'video' | null {
  const cleanUrl = value.split('?')[0].split('#')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(cleanUrl)) return 'image';
  if (/\.(mp4|webm|mov|m4v|ogg|ogv|quicktime)$/.test(cleanUrl)) return 'video';
  return null;
}

async function downloadMedia(url: string, kind: 'image' | 'video'): Promise<void> {
  const filename = getDownloadFilename(url, kind);

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('DOWNLOAD_FAILED');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, filename);
    URL.revokeObjectURL(objectUrl);
  } catch {
    triggerDownload(url, filename);
  }
}

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getDownloadFilename(url: string, kind: 'image' | 'video'): string {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();
    if (filename && filename.includes('.')) return filename;
  } catch {
    const filename = url.split('/').pop()?.split('?')[0];
    if (filename && filename.includes('.')) return filename;
  }

  return kind === 'image' ? 'muses-image.png' : 'muses-video.mp4';
}

function getTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(getTextFromChildren).join('');
  return '';
}

function createRuntimeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createWelcomeMessage(): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content: '你好！我是 Muses AI 助手。我可以帮你：\n\n- 解答使用问题\n- 提供创作灵感\n- 协助优化提示词\n\n有什么可以帮你的吗？',
    timestamp: new Date(),
  };
}

function ensureRuntimeId(runtimeIdRef: React.MutableRefObject<string>): void {
  if (runtimeIdRef.current) return;
  runtimeIdRef.current = `local:${createRuntimeId()}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createRunEvent(label: string, detail: string | undefined, status: RunEventStatus): RunEvent {
  return {
    id: createRuntimeId(),
    label,
    detail,
    status,
    timestamp: new Date(),
  };
}

function upsertToolRunEvent(
  events: RunEvent[],
  tool: { name: string; status: string; detail?: string; isError?: boolean }
): RunEvent[] {
  const toolName = tool.name;
  const existingIndex = findLastToolEventIndex(events, toolName);
  const status = tool.isError ? 'error' : getRunStatusFromTool(tool.status);
  const detail = getToolTraceDetail(tool);

  if (existingIndex === -1) {
    return [
      ...events,
      {
        ...createRunEvent(getToolDisplayName(toolName), detail, status),
        toolName,
      },
    ];
  }

  return events.map((event, index) => (
    index === existingIndex
      ? {
        ...event,
        label: getToolDisplayName(toolName),
        detail,
        status,
        timestamp: new Date(),
      }
      : event
  ));
}

function findLastToolEventIndex(events: RunEvent[], toolName: string): number {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].toolName === toolName) {
      return index;
    }
  }
  return -1;
}

function markLastActiveDone(events: RunEvent[]): RunEvent[] {
  const next = [...events];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index].status === 'active') {
      next[index] = { ...next[index], status: 'done' };
      break;
    }
  }
  return next;
}

function getRunStatusFromTool(status: string): RunEventStatus {
  const normalized = status.toLowerCase();
  if (normalized.includes('start') || normalized.includes('update') || normalized.includes('running')) {
    return 'active';
  }
  if (normalized.includes('error') || normalized.includes('fail')) {
    return 'error';
  }
  if (normalized.includes('end') || normalized.includes('done') || normalized.includes('success')) {
    return 'done';
  }
  return 'info';
}

function getToolStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('start')) return '工具开始执行';
  if (normalized.includes('update')) return '工具正在返回进度';
  if (normalized.includes('end')) return '工具执行完成';
  if (normalized.includes('error') || normalized.includes('fail')) return '工具执行失败';
  return status || '工具事件';
}

function getToolDisplayName(name: string): string {
  if (name === 'bash') return '执行命令';
  if (name === 'read') return '读取文件';
  if (name === 'write') return '写入文件';
  if (name === 'edit') return '编辑文件';
  return `调用工具 ${name}`;
}

function getToolTraceDetail(tool: { name: string; status: string; detail?: string; isError?: boolean }): string {
  if (tool.detail) {
    return tool.detail;
  }

  if (tool.isError) {
    return tool.name === 'bash' ? '命令执行失败' : getToolStatusLabel('error');
  }

  if (tool.name === 'bash') {
    const normalized = tool.status.toLowerCase();
    if (normalized.includes('start')) return '命令开始执行';
    if (normalized.includes('update')) return '命令仍在执行，已压缩中间输出';
    if (normalized.includes('end')) return '命令执行完成';
  }

  return getToolStatusLabel(tool.status);
}

function truncateForTrace(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 90)}...`;
}

function isSandboxStartedStatus(label: string): boolean {
  if (!label.includes('E2B') || !label.includes('沙箱') || label.includes('未启用')) {
    return false;
  }
  return label.includes('已开启') || label.includes('已就绪') || label.includes('创建完成');
}
