/** @jest-environment node */

process.env.DMX_API_KEY = 'test-api-key';

const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();
const mockUploadBuffer = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockAxiosPost(...args),
    get: (...args: unknown[]) => mockAxiosGet(...args),
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  },
}));

jest.mock('@/lib/serverStorage', () => ({
  uploadBuffer: (...args: unknown[]) => mockUploadBuffer(...args),
}));

jest.mock('@/lib/credits', () => ({
  withCreditBilling: async (_request: unknown, _input: unknown, work: () => Promise<Record<string, unknown>>) => ({
    ...(await work()),
    credits_charged: 10,
    credits_balance: 90,
    transaction_id: 'tx-image',
  }),
  creditErrorResponse: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('@/app/api/image/route') as typeof import('@/app/api/image/route');

function createRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as Parameters<typeof POST>[0];
}

describe('Image API Route', () => {
  beforeEach(() => {
    mockAxiosPost.mockReset();
    mockAxiosGet.mockReset();
    mockUploadBuffer.mockReset();
  });

  it('uses images/generations for gpt-image-2 text-to-image and returns uploaded urls for b64 images', async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        data: [
          { b64_json: Buffer.from('fake-png-data').toString('base64') },
        ],
      },
    });
    mockUploadBuffer.mockResolvedValue('https://cdn.example.com/generated.jpg');

    const req = createRequest({
      model: 'gpt-image-2',
      prompt: '一只坐在月球上的猫',
      size: '2K',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      urls: ['https://cdn.example.com/generated.jpg'],
      credits_charged: 10,
      credits_balance: 90,
      transaction_id: 'tx-image',
    });
    expect(mockAxiosPost).toHaveBeenCalledWith(
      'https://www.dmxapi.cn/v1/images/generations',
      expect.objectContaining({
        model: 'gpt-image-2',
        prompt: '一只坐在月球上的猫',
        n: 1,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      })
    );
    expect(mockUploadBuffer).toHaveBeenCalledTimes(1);
  });

  it('uses images/edits for gpt-image-2 when reference images are provided', async () => {
    mockAxiosGet.mockResolvedValue({
      data: Buffer.from('reference-image'),
      headers: { 'content-type': 'image/png' },
    });
    mockAxiosPost.mockResolvedValue({
      data: {
        data: [
          { url: 'https://images.example.com/edited.png' },
        ],
      },
    });

    const req = createRequest({
      model: 'gpt-image-2',
      prompt: '在图里加一个卡通水豚',
      size: '1024x1024',
      images: ['https://assets.example.com/source.png'],
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      urls: ['https://images.example.com/edited.png'],
      credits_charged: 10,
      credits_balance: 90,
      transaction_id: 'tx-image',
    });
    expect(mockAxiosGet).toHaveBeenCalledWith('https://assets.example.com/source.png', {
      responseType: 'arraybuffer',
    });
    expect(mockAxiosPost).toHaveBeenCalledWith(
      'https://www.dmxapi.cn/v1/images/edits',
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    );
  });
});
