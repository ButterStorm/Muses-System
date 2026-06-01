/** @jest-environment node */

process.env.DASHSCOPE_API_KEY = 'test-dashscope-key';
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
    credits_charged: 30,
    credits_balance: 70,
    transaction_id: 'tx-video',
  }),
  creditErrorResponse: () => null,
}));

import { POST } from '@/app/api/video/route';

function createRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as Parameters<typeof POST>[0];
}

describe('Video API Route', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAxiosPost.mockReset();
    mockAxiosGet.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops polling after the maximum attempt count', async () => {
    mockAxiosPost.mockResolvedValue({
      status: 200,
      data: { output: { task_id: 'happyhorse-task-1' } },
    });
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: { output: { task_status: 'RUNNING' } },
    });

    const responsePromise = POST(createRequest({
      provider: 'happyhorse',
      prompt: 'a calm ocean',
      duration: 5,
      aspectRatio: '16:9',
    }));

    await jest.advanceTimersByTimeAsync(20 * 60 * 1000);
    const res = await responsePromise;
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('HappyHorse 生成超时（task_id: happyhorse-task-1）');
    expect(mockAxiosGet).toHaveBeenCalledTimes(80);
  });
});
