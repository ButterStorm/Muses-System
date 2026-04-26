import { MODELS } from '@/components/nodes/unified-types';

describe('text generation models', () => {
  it('replaces deepseek-chat with the v4 models', () => {
    expect(MODELS.text).toContain('deepseek-v4-flash');
    expect(MODELS.text).toContain('deepseek-v4-pro');
    expect(MODELS.text).not.toContain('deepseek-chat');
  });

  it('includes gpt-image-2 in image generation models', () => {
    expect(MODELS.image).toContain('gpt-image-2');
  });
});
