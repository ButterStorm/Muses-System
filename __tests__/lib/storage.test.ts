/**
 * @jest-environment jsdom
 */

import { uploadFile, uploadImage } from '@/lib/storage';

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

  it('revokes object urls after image compression succeeds', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:image-source'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    const createObjectURL = jest.mocked(URL.createObjectURL);
    const revokeObjectURL = jest.mocked(URL.revokeObjectURL);
    const originalImage = global.Image;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: jest.fn(() => ({ drawImage: jest.fn() })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: jest.fn((callback: BlobCallback) => {
        callback(new Blob(['compressed'], { type: 'image/jpeg' }));
      }),
    });

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 100;
      height = 100;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    global.Image = MockImage as unknown as typeof Image;

    try {
      const file = new File(['image'], 'demo.png', { type: 'image/png' });

      await uploadImage(file);

      expect(createObjectURL).toHaveBeenCalledWith(file);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:image-source');
      expect(fetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }));
    } finally {
      global.Image = originalImage;
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', {
          configurable: true,
          value: originalCreateObjectURL,
        });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', {
          configurable: true,
          value: originalRevokeObjectURL,
        });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: originalGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        configurable: true,
        value: originalToBlob,
      });
    }
  });
});
