import { createMusesAgent } from './createMusesAgent';
import type { AgentChatInput, AgentChatMessage, AgentChatResult } from './types';

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
  const session = await createMusesAgent({ model });
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
    session.dispose();
  }

  const trimmedResponse = response.trim();
  if (!trimmedResponse) {
    throw new Error('AI 返回内容为空');
  }

  return {
    response: trimmedResponse,
  };
}
