import { MODELS } from '@/components/nodes/unified-types';
import { getModelLabel } from '@/lib/modelCatalog';

describe('text generation models', () => {
  it('replaces deepseek-chat with the v4 models', () => {
    expect(MODELS.text).toContain('deepseek-v4-flash');
    expect(MODELS.text).toContain('deepseek-v4-pro');
    expect(MODELS.text).not.toContain('deepseek-chat');
  });

  it('includes gpt-image-2 in image generation models', () => {
    expect(MODELS.image).toContain('gpt-image-2');
  });

  it('includes recraft vector in image models and whisper in audio models', () => {
    expect(MODELS.image[0]).toBe('doubao-seedream-5.0-lite');
    expect(MODELS.image).toContain('recraft-v4.1-pro-vector');
    expect(MODELS.audio).toContain('whisper-1');
  });

  it('uses doubao seed 2.0 lite instead of seed 1.8 for text generation', () => {
    expect(MODELS.text).toContain('doubao-seed-2-0-lite-260215');
    expect(MODELS.text).not.toContain('doubao-seed-1-8-251228');
  });

  it('includes grok 4.3 in text generation models', () => {
    expect(MODELS.text).toContain('grok-4.3');
    expect(getModelLabel('text', 'grok-4.3')).toBe('Grok 4.3');
  });

  it('displays suno versions instead of 302 chirp model ids', () => {
    expect(getModelLabel('music', 'chirp-fenix')).toBe('Suno V5.5');
    expect(getModelLabel('music', 'chirp-crow')).toBe('Suno V5');
    expect(getModelLabel('music', 'chirp-bluejay')).toBe('Suno V4.5+');
  });
});
