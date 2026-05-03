import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent';
import { getModel } from '@mariozechner/pi-ai';
import type { Model } from '@mariozechner/pi-ai';

const DEFAULT_AGENT_MODEL = process.env.MUSES_AGENT_MODEL || 'openai:gpt-4o';

const MUSES_AGENT_SYSTEM_PROMPT = `You are a helpful AI assistant embedded in a creative canvas application called MusesSystem.

You help users with their tasks, answer questions, and provide creative inspiration.

Keep your answers practical, concise, and collaborative.`;

interface CreateMusesAgentOptions {
  model?: string;
}

function resolveModel(model: string, modelRegistry: ModelRegistry): Model<any> {
  const [provider, ...modelParts] = model.split(':');
  const modelId = modelParts.join(':');

  if (!provider || !modelId) {
    throw new Error(`模型格式无效：${model}`);
  }

  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('缺少 OPENAI_API_KEY，无法调用 Pi SDK');
  }

  const builtInModel = getModel(provider as never, modelId as never) as Model<any> | undefined;
  const registryModel = modelRegistry.find(provider, modelId) as Model<any> | undefined;
  const resolved = builtInModel || registryModel;

  if (!resolved) {
    throw new Error(`Pi SDK 未找到模型：${model}`);
  }

  return resolved;
}

export async function createMusesAgent({ model }: CreateMusesAgentOptions = {}) {
  const resolvedModel = model || DEFAULT_AGENT_MODEL;
  const authStorage = AuthStorage.inMemory();

  if (process.env.OPENAI_API_KEY) {
    authStorage.setRuntimeApiKey('openai', process.env.OPENAI_API_KEY);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    authStorage.setRuntimeApiKey('anthropic', process.env.ANTHROPIC_API_KEY);
  }

  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => MUSES_AGENT_SYSTEM_PROMPT,
    appendSystemPromptOverride: () => [],
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    model: resolveModel(resolvedModel, modelRegistry),
    noTools: 'all',
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  return session;
}
