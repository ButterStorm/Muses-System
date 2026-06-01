export interface ApiProviderConfig {
  apiKey?: string;
  baseUrl: string;
}

export function getDmxConfig(): ApiProviderConfig {
  return {
    apiKey: process.env.DMX_API_KEY,
    baseUrl: normalizeBaseUrl(process.env.DMX_BASE_URL || 'https://www.dmxapi.cn'),
  };
}

export function getAi302Config(): ApiProviderConfig {
  return {
    apiKey: process.env.AI302_API_KEY,
    baseUrl: normalizeBaseUrl(process.env.AI302_BASE_URL || 'https://api.302ai.com'),
  };
}

export function getDashScopeConfig(): ApiProviderConfig {
  return {
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseUrl: normalizeBaseUrl(process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com'),
  };
}

export function formatBearerToken(apiKey: string): string {
  return apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}
