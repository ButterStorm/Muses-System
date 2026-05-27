import { createMusesAgent } from './createMusesAgent';
import { getDefaultAgentModel } from '@/lib/agents/model-router';
import {
  acquireRuntimeLock,
  getOrCreateAgentRuntime,
  hasMatchingAgentRuntime,
  resetAgentRuntimeContext,
} from '@/lib/agents/runtime/manager';
import type {
  AgentChatInput,
  AgentChatMessage,
  AgentChatResult,
  AgentSandboxStartInput,
  AgentStreamChatInput,
} from './types';

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CONTENT_LENGTH = 1200;

function formatHistoryMessage(message: AgentChatMessage): string {
  const speaker = message.role === 'user' ? '用户' : '助手';
  const content = message.content.trim().slice(0, MAX_HISTORY_CONTENT_LENGTH);
  return `${speaker}: ${content}`;
}

function buildPrompt(message: string, history?: AgentChatMessage[]): string {
  const trimmedMessage = message.trim();
  const recentHistory = history
    ?.filter((item) => item.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(formatHistoryMessage);

  if (!recentHistory?.length) {
    return trimmedMessage;
  }

  return [
    '以下是你和用户最近的对话历史，请结合上下文回答当前用户消息。',
    '',
    recentHistory.join('\n'),
    '',
    `当前用户消息: ${trimmedMessage}`,
  ].join('\n');
}

export async function chat({
  message,
  model,
  history,
}: AgentChatInput): Promise<AgentChatResult> {
  const session = await createMusesAgent({ model: model || getDefaultAgentModel() });
  let response = '';

  const unsubscribe = session.subscribe((event) => {
    if (
      event.type === 'message_update' &&
      event.assistantMessageEvent.type === 'text_delta'
    ) {
      response += event.assistantMessageEvent.delta;
    }
  });

  try {
    await session.prompt(buildPrompt(message, history));
  } finally {
    unsubscribe();
    await session.dispose();
  }

  const trimmedResponse = response.trim();
  if (!trimmedResponse) {
    throw new Error('AI 返回内容为空');
  }

  return {
    response: trimmedResponse,
  };
}

export async function streamChat({
  runtimeId,
  message,
  model,
  onEvent,
}: AgentStreamChatInput): Promise<AgentChatResult> {
  const resolvedModel = model || getDefaultAgentModel();

  onEvent({ type: 'runtime', runtimeId, model: resolvedModel });
  onEvent({ type: 'status', label: '请求进入 Agent runtime', detail: runtimeId, status: 'done' });
  onEvent({ type: 'status', label: '检查 runtime 缓存', detail: resolvedModel, status: 'active' });

  const willReuseRuntime = hasMatchingAgentRuntime(runtimeId, resolvedModel);

  const runtime = await getOrCreateAgentRuntime({
    runtimeId,
    model: resolvedModel,
    createSession: async (nextModel, sandboxRuntime) => createMusesAgent({
      model: nextModel,
      sandboxRuntime,
      onStatus: (event) => onEvent({ type: 'status', ...event }),
    }),
  });
  onEvent({
    type: 'status',
    label: willReuseRuntime ? '复用已有 runtime session' : 'runtime session 创建完成',
    detail: willReuseRuntime ? '模型未变化，沿用当前会话上下文' : '已建立新的会话上下文',
    status: 'done',
  });
  if (runtime.session.sandboxRuntime?.isStarted?.()) {
    onEvent({
      type: 'status',
      label: 'E2B 沙箱已就绪',
      detail: `${runtime.session.sandboxRuntime.id} · ${runtime.session.sandboxRuntime.cwd}`,
      status: 'done',
    });
  }

  const release = acquireRuntimeLock(runtimeId);
  onEvent({ type: 'status', label: '获取流式锁', detail: '防止同一 runtime 并发写入', status: 'done' });
  let response = '';

  const unsubscribe = runtime.session.subscribe((event) => {
    if (
      event.type === 'message_update' &&
      event.assistantMessageEvent.type === 'text_delta'
    ) {
      response += event.assistantMessageEvent.delta;
      onEvent({ type: 'delta', text: event.assistantMessageEvent.delta });
    }

    if (event.type === 'tool_execution_start') {
      onEvent({
        type: 'tool',
        name: event.toolName,
        status: 'start',
        detail: getToolStartDetail(event.toolName, event.args),
      });
    }

    if (event.type === 'tool_execution_update') {
      onEvent({
        type: 'tool',
        name: event.toolName,
        status: 'update',
        detail: getToolUpdateDetail(event.toolName, event.partialResult),
      });
    }

    if (event.type === 'tool_execution_end') {
      onEvent({
        type: 'tool',
        name: event.toolName,
        status: 'end',
        detail: getToolEndDetail(event.toolName, event.result, Boolean(event.isError)),
        isError: Boolean(event.isError),
      });
    }
  });

  try {
    onEvent({ type: 'status', label: '发送 prompt', detail: '等待模型和工具事件返回', status: 'active' });
    await runtime.session.prompt(message.trim());
  } finally {
    unsubscribe();
    release();
  }

  const trimmedResponse = response.trim();
  if (!trimmedResponse) {
    throw new Error('AI 返回内容为空');
  }

  onEvent({ type: 'done', response: trimmedResponse });
  return { response: trimmedResponse };
}

export async function resetChatRuntimeContext({
  runtimeId,
  model,
}: {
  runtimeId: string;
  model?: string;
}): Promise<boolean> {
  const resolvedModel = model || getDefaultAgentModel();
  return resetAgentRuntimeContext({
    runtimeId,
    model: resolvedModel,
    createSession: async (nextModel, sandboxRuntime) => createMusesAgent({
      model: nextModel,
      sandboxRuntime,
    }),
  });
}

export async function startChatSandboxRuntime({
  runtimeId,
  model,
  onEvent,
}: AgentSandboxStartInput): Promise<void> {
  const resolvedModel = model || getDefaultAgentModel();

  onEvent({ type: 'runtime', runtimeId, model: resolvedModel });
  onEvent({ type: 'status', label: '准备开启 E2B 沙箱', detail: runtimeId, status: 'active' });

  const runtime = await getOrCreateAgentRuntime({
    runtimeId,
    model: resolvedModel,
    createSession: async (nextModel, sandboxRuntime) => createMusesAgent({
      model: nextModel,
      sandboxRuntime,
      onStatus: (event) => onEvent({ type: 'status', ...event }),
    }),
  });

  const release = acquireRuntimeLock(runtimeId);
  try {
    const sandboxRuntime = runtime.session.sandboxRuntime;
    if (!sandboxRuntime) {
      onEvent({
        type: 'status',
        label: 'E2B 沙箱未启用',
        detail: '当前环境没有配置 E2B_API_KEY 或 AGENT_SANDBOX_PROVIDER=e2b',
        status: 'info',
      });
      onEvent({ type: 'done', response: 'sandbox disabled' });
      return;
    }

    onEvent({
      type: 'status',
      label: sandboxRuntime.isStarted?.() ? '检查 E2B 沙箱状态' : '开始创建 E2B 沙箱',
      detail: sandboxRuntime.cwd,
      status: 'active',
    });
    await sandboxRuntime.access(sandboxRuntime.cwd);
    onEvent({
      type: 'status',
      label: 'E2B 沙箱已开启',
      detail: `${sandboxRuntime.id} · ${sandboxRuntime.cwd}`,
      status: 'done',
    });
    onEvent({ type: 'done', response: 'sandbox started' });
  } finally {
    release();
  }
}

function getToolStartDetail(toolName: string, args: unknown): string | undefined {
  if (toolName === 'bash') {
    const command = getObjectString(args, 'command');
    return command ? `$ ${truncateTraceLine(command)}` : '命令开始执行';
  }

  const pathValue = getObjectString(args, 'path') || getObjectString(args, 'file_path');
  if (pathValue) return pathValue;
  return undefined;
}

function getToolUpdateDetail(toolName: string, partialResult: unknown): string | undefined {
  const text = extractToolText(partialResult);
  if (!text) return undefined;

  if (toolName === 'bash') {
    return truncateTraceLine(text);
  }

  return truncateTraceLine(text);
}

function getToolEndDetail(toolName: string, result: unknown, isError: boolean): string | undefined {
  if (isError) {
    const text = extractToolText(result);
    return text ? truncateTraceLine(text) : undefined;
  }

  if (toolName === 'bash') {
    const text = extractToolText(result);
    return text ? truncateTraceLine(text) : '命令执行完成';
  }

  return undefined;
}

function extractToolText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;

  const content = (value as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string') {
          return (item as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
    return text || undefined;
  }

  const text = (value as { text?: unknown }).text;
  return typeof text === 'string' ? text : undefined;
}

function getObjectString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === 'string' ? item : undefined;
}

function truncateTraceLine(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 180)}...`;
}
