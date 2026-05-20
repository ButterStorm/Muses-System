export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatInput {
  message: string;
  model?: string;
  history?: AgentChatMessage[];
}

export interface AgentChatResult {
  response: string;
}

export interface AgentStreamChatInput {
  runtimeId: string;
  message: string;
  model?: string;
  onEvent: (event: import('@/lib/agents/runtime/types').AgentStreamEvent) => void;
}

export interface AgentSandboxStartInput {
  runtimeId: string;
  model?: string;
  onEvent: (event: import('@/lib/agents/runtime/types').AgentStreamEvent) => void;
}
