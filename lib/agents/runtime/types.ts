import type { AgentSandboxRuntime } from '@/lib/agents/sandbox/types';

export type AgentRuntimeId = string;

export interface AgentStreamRequest {
  runtimeId: AgentRuntimeId;
  message: string;
  model?: string;
}

export type AgentStreamEvent =
  | { type: 'runtime'; runtimeId: AgentRuntimeId; model: string }
  | { type: 'status'; label: string; detail?: string; status?: 'active' | 'done' | 'error' | 'info' }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; status: 'start' | 'update' | 'end'; detail?: string; isError?: boolean }
  | { type: 'done'; response: string }
  | { type: 'error'; error: string };

export interface AgentRuntimeSession {
  subscribe: (listener: (event: any) => void) => () => void;
  prompt: (text: string, options?: any) => Promise<void>;
  dispose: (options?: { disposeSandbox?: boolean }) => void | Promise<void>;
  sandboxRuntime?: AgentSandboxRuntime;
}

export interface AgentRuntimeEntry {
  runtimeId: AgentRuntimeId;
  model: string;
  session: AgentRuntimeSession;
  createdAt: number;
  lastActiveAt: number;
  isStreaming: boolean;
}
