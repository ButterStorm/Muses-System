import axios from 'axios';
import { API_TIMEOUTS, createApiClient } from './apiClient';

const axiosClient = createApiClient(API_TIMEOUTS.standard);

interface AgentChatResponse {
  response: string;
}

interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentChatError {
  error: string;
  details?: unknown;
}

interface AgentChatOptions {
  model?: string;
  history?: AgentChatMessage[];
}

interface AgentStreamOptions {
  runtimeId: string;
  model?: string;
  signal?: AbortSignal;
  onRuntime?: (runtime: { runtimeId: string; model: string }) => void;
  onStatus?: (status: { label: string; detail?: string; status?: 'active' | 'done' | 'error' | 'info' }) => void;
  onDelta?: (text: string) => void;
  onTool?: (tool: { name: string; status: string; detail?: string; isError?: boolean }) => void;
  onDone?: (response: string) => void;
}

interface AgentRuntimeActionOptions {
  runtimeId: string;
  model?: string;
  signal?: AbortSignal;
  onRuntime?: (runtime: { runtimeId: string; model: string }) => void;
  onStatus?: (status: { label: string; detail?: string; status?: 'active' | 'done' | 'error' | 'info' }) => void;
}

/**
 * Agent 服务类 - 处理 AI 对话
 */
export class AgentService {
  /**
   * 发送消息给 AI Agent
   * @param message - 用户消息
   * @returns AI 回复
   */
  async sendMessage(message: string, options: AgentChatOptions = {}): Promise<string> {
    try {
      const response = await axiosClient.post<AgentChatResponse>('/agent', {
        message,
        model: options.model,
        history: options.history,
      });

      const content = response.data?.response;
      if (!content || content.trim().length === 0) {
        throw new Error('AI 返回内容为空');
      }

      return content;
    } catch (error) {
      console.error('Error calling AI agent:', error);

      if (axios.isAxiosError(error)) {
        const data = error.response?.data as AgentChatError | undefined;
        const errorMessage = data?.error || error.message || 'AI 助手响应失败';
        throw new Error(errorMessage);
      }

      throw new Error('AI 助手响应失败，请稍后重试');
    }
  }

  async streamMessage(message: string, options: AgentStreamOptions): Promise<string> {
    const headers = await getAuthJsonHeaders();
    const response = await fetch('/api/agent/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        runtimeId: options.runtimeId,
        message,
        model: options.model,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null) as AgentChatError | null;
      throw new Error(data?.error || 'AI 助手响应失败');
    }

    if (!response.body) {
      throw new Error('AI 助手响应失败，请稍后重试');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const event = parseSseEvent(part);
        if (!event) continue;

        if (event.type === 'delta' && typeof event.text === 'string') {
          options.onDelta?.(event.text);
        }

        if (event.type === 'runtime' && typeof event.runtimeId === 'string') {
          options.onRuntime?.({
            runtimeId: event.runtimeId,
            model: typeof event.model === 'string' ? event.model : '',
          });
        }

        if (event.type === 'status' && typeof event.label === 'string') {
          options.onStatus?.({
            label: event.label,
            detail: typeof event.detail === 'string' ? event.detail : undefined,
            status: isAgentStatus(event.status) ? event.status : undefined,
          });
        }

        if (event.type === 'tool' && typeof event.name === 'string') {
          options.onTool?.({
            name: event.name,
            status: String(event.status || ''),
            detail: typeof event.detail === 'string' ? event.detail : undefined,
            isError: Boolean(event.isError),
          });
        }

        if (event.type === 'done' && typeof event.response === 'string') {
          finalResponse = event.response;
          options.onDone?.(event.response);
        }

        if (event.type === 'error' && typeof event.error === 'string') {
          throw new Error(event.error);
        }
      }
    }

    return finalResponse;
  }

  async openRuntime(options: AgentRuntimeActionOptions): Promise<void> {
    const headers = await getAuthJsonHeaders();
    const response = await fetch('/api/agent/stream', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        runtimeId: options.runtimeId,
        model: options.model,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null) as AgentChatError | null;
      throw new Error(data?.error || '开启沙盒失败');
    }

    if (!response.body) {
      throw new Error('开启沙盒失败，请稍后重试');
    }

    await consumeAgentEventStream(response.body, {
      onRuntime: options.onRuntime,
      onStatus: options.onStatus,
    });
  }

  async closeRuntime(runtimeId: string): Promise<void> {
    const headers = await getAuthJsonHeaders();
    const response = await fetch('/api/agent/stream', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ runtimeId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null) as AgentChatError | null;
      throw new Error(data?.error || '关闭沙盒失败');
    }
  }

  async resetRuntimeContext(runtimeId: string): Promise<void> {
    const headers = await getAuthJsonHeaders();
    const response = await fetch('/api/agent/stream', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ runtimeId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null) as AgentChatError | null;
      throw new Error(data?.error || '刷新会话失败');
    }
  }
}

// 导出单例实例
export const agentService = new AgentService();

async function getAuthJsonHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;

  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function consumeAgentEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onRuntime?: (runtime: { runtimeId: string; model: string }) => void;
    onStatus?: (status: { label: string; detail?: string; status?: 'active' | 'done' | 'error' | 'info' }) => void;
  }
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const event = parseSseEvent(part);
      if (!event) continue;

      if (event.type === 'runtime' && typeof event.runtimeId === 'string') {
        handlers.onRuntime?.({
          runtimeId: event.runtimeId,
          model: typeof event.model === 'string' ? event.model : '',
        });
      }

      if (event.type === 'status' && typeof event.label === 'string') {
        handlers.onStatus?.({
          label: event.label,
          detail: typeof event.detail === 'string' ? event.detail : undefined,
          status: isAgentStatus(event.status) ? event.status : undefined,
        });
      }

      if (event.type === 'error' && typeof event.error === 'string') {
        throw new Error(event.error);
      }
    }
  }
}

function parseSseEvent(chunk: string): Record<string, unknown> | null {
  const dataLine = chunk
    .split('\n')
    .find((line) => line.startsWith('data:'));

  if (!dataLine) return null;

  try {
    return JSON.parse(dataLine.slice('data:'.length).trim());
  } catch {
    return null;
  }
}

function isAgentStatus(status: unknown): status is 'active' | 'done' | 'error' | 'info' {
  return status === 'active' || status === 'done' || status === 'error' || status === 'info';
}
