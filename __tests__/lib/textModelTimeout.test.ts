import { getTextModelTimeoutMs } from '@/lib/textModelTimeout';

describe('getTextModelTimeoutMs', () => {
  it('uses a longer timeout for deepseek-v4-pro', () => {
    expect(getTextModelTimeoutMs('deepseek-v4-pro')).toBe(420000);
  });

  it('keeps the default timeout for other text models', () => {
    expect(getTextModelTimeoutMs('deepseek-v4-flash')).toBe(120000);
    expect(getTextModelTimeoutMs('gpt-5-mini')).toBe(120000);
  });
});
