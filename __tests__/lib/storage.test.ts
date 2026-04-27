/**
 * @jest-environment jsdom
 */

import { uploadFile } from '@/lib/storage';

describe('browser storage upload helpers', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://assets.example.com/uploads/demo.png' }),
    }) as jest.Mock;
  });

  it('uploads files through the server upload route instead of exposing storage credentials', async () => {
    const file = new File(['hello'], 'demo.png', { type: 'image/png' });

    const url = await uploadFile(file);

    expect(url).toBe('https://assets.example.com/uploads/demo.png');
    expect(fetch).toHaveBeenCalledWith('/api/upload', {
      method: 'POST',
      body: expect.any(FormData),
    });
  });
});
