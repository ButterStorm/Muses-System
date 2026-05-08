/** @jest-environment node */

import { EventEmitter } from 'node:events';

// Mock environment variables
process.env.DMX_API_KEY = 'test-api-key';

const mockHttpsRequest = jest.fn();

jest.mock('node:https', () => ({
  __esModule: true,
  default: {
    request: (...args: unknown[]) => mockHttpsRequest(...args),
  },
}));

jest.mock('@/lib/credits', () => ({
  withCreditBilling: async (_request: unknown, _input: unknown, work: () => Promise<Record<string, unknown>>) => ({
    ...(await work()),
    credits_charged: 1,
    credits_balance: 99,
    transaction_id: 'tx-test',
  }),
  creditErrorResponse: () => null,
}));

// Import after env setup because the route reads env at module load time.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('@/app/api/text/route') as typeof import('@/app/api/text/route');

function createRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as Parameters<typeof POST>[0];
}

function mockHttpsResponse(status: number, body?: unknown) {
  mockHttpsRequest.mockImplementation((_options: unknown, callback: (res: EventEmitter & { statusCode?: number; setEncoding: (encoding: string) => void }) => void) => {
    const response = new EventEmitter() as EventEmitter & { statusCode?: number; setEncoding: (encoding: string) => void };
    response.statusCode = status;
    response.setEncoding = () => undefined;

    const request = new EventEmitter() as EventEmitter & {
      setTimeout: (timeout: number, handler: () => void) => void;
      write: (chunk: string) => void;
      end: () => void;
      destroy: (error?: Error) => void;
    };

    request.setTimeout = () => undefined;
    request.write = () => undefined;
    request.end = () => {
      callback(response);
      process.nextTick(() => {
        if (body !== undefined) {
          response.emit('data', JSON.stringify(body));
        }
        response.emit('end');
      });
    };
    request.destroy = (error?: Error) => {
      if (error) {
        request.emit('error', error);
      }
    };

    return request;
  });
}

describe('Text API Route', () => {
  beforeEach(() => {
    mockHttpsRequest.mockReset();
  });

  describe('Input Validation', () => {
    it('should reject empty prompt', async () => {
      const req = createRequest({ prompt: '', model: 'gpt-5-mini' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('输入验证失败');
    });

    it('should reject invalid model', async () => {
      const req = createRequest({ prompt: 'hello', model: 'invalid-model' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('输入验证失败');
    });

    it('should accept deepseek v4 text models and reject deepseek-chat', async () => {
      mockHttpsResponse(200, {
        choices: [{ message: { content: 'ok' } }],
      });

      const flashReq = createRequest({ prompt: 'hello', model: 'deepseek-v4-flash' });
      const flashRes = await POST(flashReq);
      expect(flashRes.status).toBe(200);

      const proReq = createRequest({ prompt: 'hello', model: 'deepseek-v4-pro' });
      const proRes = await POST(proReq);
      expect(proRes.status).toBe(200);

      const legacyReq = createRequest({ prompt: 'hello', model: 'deepseek-chat' });
      const legacyRes = await POST(legacyReq);
      expect(legacyRes.status).toBe(400);
    });

    it('should reject prompt exceeding max length', async () => {
      const req = createRequest({ prompt: 'x'.repeat(8001), model: 'gpt-5-mini' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should accept valid input', async () => {
      mockHttpsResponse(200, {
        choices: [{ message: { content: 'Write a poem' } }],
      });

      const req = createRequest({ prompt: 'Write a poem', model: 'gpt-5-mini' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        text: 'Write a poem',
        credits_charged: 1,
        credits_balance: 99,
        transaction_id: 'tx-test',
      });
      expect(mockHttpsRequest).toHaveBeenCalled();
    });

    it('should call DMX via https for deepseek-v4-pro', async () => {
      mockHttpsResponse(200, {
        choices: [{ message: { content: '同一个人' } }],
      });

      const req = createRequest({ prompt: '周树人和鲁迅是兄弟吗？', model: 'deepseek-v4-pro' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        text: '同一个人',
        credits_charged: 1,
        credits_balance: 99,
        transaction_id: 'tx-test',
      });
      expect(mockHttpsRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          hostname: 'www.dmxapi.cn',
          path: '/v1/chat/completions',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        }),
        expect.any(Function)
      );
    });
  });
});
