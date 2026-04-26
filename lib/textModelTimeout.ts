const DEFAULT_TEXT_MODEL_TIMEOUT_MS = 120000;
const DEEPSEEK_V4_PRO_TIMEOUT_MS = 420000;

export function getTextModelTimeoutMs(model: string): number {
  return model === 'deepseek-v4-pro'
    ? DEEPSEEK_V4_PRO_TIMEOUT_MS
    : DEFAULT_TEXT_MODEL_TIMEOUT_MS;
}
