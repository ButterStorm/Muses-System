import { createMusesAgent } from './createMusesAgent';
import type { AgentChatInput, AgentChatResult } from './types';

interface AgentInvocationResult {
  messages?: Array<{
    content?: unknown;
  }>;
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (
          item &&
          typeof item === 'object' &&
          'text' in item &&
          typeof item.text === 'string'
        ) {
          return item.text;
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function extractFinalResponse(result: AgentInvocationResult): string {
  const messages = result.messages || [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const response = extractTextFromContent(messages[index]?.content);
    if (response) {
      return response;
    }
  }

  throw new Error('AI 返回内容为空');
}

export async function chat({
  message,
  model,
}: AgentChatInput): Promise<AgentChatResult> {
  const agent = createMusesAgent({ model });
  const result = (await agent.invoke({
    messages: [{ role: 'user', content: message }],
  })) as AgentInvocationResult;

  return {
    response: extractFinalResponse(result),
  };
}
