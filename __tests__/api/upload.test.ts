/** @jest-environment node */

import { POST } from '@/app/api/upload/route';
import { uploadBuffer } from '@/lib/serverStorage';

jest.mock('@/lib/serverStorage', () => ({
  uploadBuffer: jest.fn(),
}));

const mockedUploadBuffer = jest.mocked(uploadBuffer);

describe('Upload API Route', () => {
  beforeEach(() => {
    mockedUploadBuffer.mockReset();
  });

  it('uploads multipart files through server storage', async () => {
    mockedUploadBuffer.mockResolvedValue('https://assets.example.com/uploads/demo.png');
    const formData = new FormData();
    formData.append('file', new File(['demo'], 'demo.png', { type: 'image/png' }));

    const req = {
      formData: async () => formData,
    };

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ url: 'https://assets.example.com/uploads/demo.png' });
    expect(mockedUploadBuffer).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'image/png', 'png');
  });

  it('rejects requests without a file', async () => {
    const req = {
      formData: async () => new FormData(),
    };

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: '缺少上传文件' });
  });

  it('rejects unsupported file types before calling storage', async () => {
    const formData = new FormData();
    formData.append('file', new File(['demo'], 'demo.txt', { type: 'text/plain' }));
    const req = {
      formData: async () => formData,
    };

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(415);
    expect(data).toEqual({ error: '不支持的文件类型: text/plain' });
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
  });

  it('rejects oversized files before calling storage', async () => {
    const formData = new FormData();
    formData.append('file', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
    const req = {
      formData: async () => formData,
    };

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(413);
    expect(data).toEqual({ error: '文件大小超过限制（最大 10MB）' });
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
  });
});
