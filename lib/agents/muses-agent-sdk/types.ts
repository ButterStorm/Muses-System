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
