import { getModel } from '@mariozechner/pi-ai';
import type { Model } from '@mariozechner/pi-ai';

export type AgentModelKey = string;

export interface AgentModelCapabilities {
  supportsImage: boolean;
  supportsReasoning: boolean;
  contextWindow: number;
  maxTokens: number;
}

export interface ResolvedAgentModel {
  key: AgentModelKey;
  provider: string;
  modelId: string;
  model: Model<any>;
  capabilities: AgentModelCapabilities;
}

export interface AgentModelRoute {
  key: AgentModelKey;
  label: string;
  provider: string;
  modelId: string;
  capabilities: AgentModelCapabilities;
}

interface AgentModelRegistry {
  find(provider: string, modelId: string): Model<any> | undefined;
}

export const DEFAULT_AGENT_MODEL = process.env.MUSES_AGENT_MODEL || 'deepseek:deepseek-v4-flash';

export const AGENT_MODEL_ROUTES: AgentModelRoute[] = [
  {
    key: 'deepseek:deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    provider: 'deepseek',
    modelId: 'deepseek-v4-flash',
    capabilities: {
      supportsImage: false,
      supportsReasoning: false,
      contextWindow: 128000,
      maxTokens: 8192,
    },
  },
  {
    key: 'deepseek:deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    provider: 'deepseek',
    modelId: 'deepseek-v4-pro',
    capabilities: {
      supportsImage: false,
      supportsReasoning: false,
      contextWindow: 128000,
      maxTokens: 8192,
    },
  },
  {
    key: 'openai:gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    capabilities: {
      supportsImage: true,
      supportsReasoning: false,
      contextWindow: 128000,
      maxTokens: 16384,
    },
  },
];

const ROUTES_BY_KEY = new Map(AGENT_MODEL_ROUTES.map((route) => [route.key, route]));

export function isAllowedAgentModel(model: string): boolean {
  return ROUTES_BY_KEY.has(model);
}

export function getDefaultAgentModel(): AgentModelKey {
  return isAllowedAgentModel(DEFAULT_AGENT_MODEL)
    ? DEFAULT_AGENT_MODEL
    : 'deepseek:deepseek-v4-flash';
}

export function resolveAgentModel(
  key: AgentModelKey,
  modelRegistry: AgentModelRegistry
): ResolvedAgentModel {
  const parsed = parseAgentModelKey(key);
  const route = ROUTES_BY_KEY.get(key);

  if (!route) {
    throw new Error(`AGENT_MODEL_NOT_ALLOWED:${key}`);
  }

  assertProviderConfigured(parsed.provider);

  const model = resolveBuiltInModel(parsed.provider, parsed.modelId, modelRegistry);

  return {
    key,
    provider: parsed.provider,
    modelId: parsed.modelId,
    model,
    capabilities: {
      supportsImage: model.input.includes('image'),
      supportsReasoning: model.reasoning,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    },
  };
}

function parseAgentModelKey(key: AgentModelKey): { provider: string; modelId: string } {
  const [provider, ...modelParts] = key.split(':');
  const modelId = modelParts.join(':');

  if (!provider || !modelId) {
    throw new Error(`AGENT_MODEL_KEY_INVALID:${key}`);
  }

  return { provider, modelId };
}

function resolveBuiltInModel(
  provider: string,
  modelId: string,
  modelRegistry: AgentModelRegistry
): Model<any> {
  const builtInModel = safeGetModel(provider, modelId);
  const registryModel = modelRegistry.find(provider, modelId);
  const resolved = builtInModel || registryModel;

  if (!resolved) {
    throw new Error(`AGENT_MODEL_NOT_FOUND:${provider}:${modelId}`);
  }

  return resolved;
}

function assertProviderConfigured(provider: string): void {
  if (provider === 'deepseek' && !process.env.DeepSeek_API_KEY) {
    throw new Error('AGENT_PROVIDER_CONFIG_MISSING:deepseek');
  }
}

function safeGetModel(provider: string, modelId: string): Model<any> | undefined {
  try {
    return getModel(provider as never, modelId as never) as Model<any> | undefined;
  } catch {
    return undefined;
  }
}
