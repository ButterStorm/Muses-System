import { createMusesAgent } from './createMusesAgent';
import type { AgentChatInput, AgentChatResult } from './types';

export async function chat({
  message,
  model,
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
    await session.prompt(message);
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
