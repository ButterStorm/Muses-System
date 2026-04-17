import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';

const DEFAULT_AGENT_MODEL = process.env.MUSES_AGENT_MODEL || 'openai:gpt-4o';
const OPENAI_MODEL_PREFIX = 'openai:';

const MUSES_AGENT_SYSTEM_PROMPT = `You are a helpful AI assistant embedded in a creative canvas application called MusesSystem.

You help users with their tasks, answer questions, and provide creative inspiration.

Keep your answers practical, concise, and collaborative.`;

interface CreateMusesAgentOptions {
  model?: string;
}

export function createMusesAgent({ model }: CreateMusesAgentOptions = {}) {
  const resolvedModel = model || DEFAULT_AGENT_MODEL;

  if (resolvedModel.startsWith(OPENAI_MODEL_PREFIX) && !process.env.OPENAI_API_KEY) {
    throw new Error('缺少 OPENAI_API_KEY，无法调用本地 DeepAgents SDK');
  }

  const modelInstance = resolvedModel.startsWith(OPENAI_MODEL_PREFIX)
    ? new ChatOpenAI({
        model: resolvedModel.slice(OPENAI_MODEL_PREFIX.length),
        apiKey: process.env.OPENAI_API_KEY,
      })
    : resolvedModel;

  return createDeepAgent({
    name: 'muses-agent',
    model: modelInstance,
    systemPrompt: MUSES_AGENT_SYSTEM_PROMPT,
  });
}
