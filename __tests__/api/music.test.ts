/** @jest-environment node */

process.env.AI302_API_KEY = 'test-302-key';
process.env.DMX_API_KEY = 'test-dmx-key';

const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockAxiosPost(...args),
    get: (...args: unknown[]) => mockAxiosGet(...args),
    isAxiosError: () => false,
  },
}));

jest.mock('@/lib/credits', () => ({
  withCreditBilling: async (_request: unknown, _input: unknown, work: () => Promise<Record<string, unknown>>) => ({
    ...(await work()),
    credits_charged: 20,
    credits_balance: 80,
    transaction_id: 'tx-music',
  }),
  creditErrorResponse: () => null,
}));

import { POST } from '@/app/api/music/route';

function createRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as Parameters<typeof POST>[0];
}

describe('Music API Route', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAxiosPost.mockReset();
    mockAxiosGet.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses timeout for 302 Suno fetch polling', async () => {
    mockAxiosPost.mockResolvedValue({ data: { code: 200, data: 'task-1' } });
    mockAxiosGet.mockResolvedValue({
      data: {
        data: {
          status: 'SUCCESS',
          data: [{ audio_url: 'https://cdn.suno.ai/song.mp3', image_url: 'https://cdn.suno.ai/cover.jpg' }],
        },
      },
    });

    const responsePromise = POST(createRequest({
      mode: 'inspiration',
      description: 'ambient piano',
      makeInstrumental: true,
      mv: 'chirp-crow',
    }));

    await jest.advanceTimersByTimeAsync(5_000);
    const res = await responsePromise;
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.songs).toHaveLength(1);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      'https://api.302ai.com/suno/fetch/task-1',
      expect.objectContaining({
        timeout: 10_000,
        headers: expect.objectContaining({
          Authorization: 'Bearer test-302-key',
        }),
      })
    );
  });
});
