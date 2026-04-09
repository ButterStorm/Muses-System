import { POST } from '@/app/api/text/route';
import { NextRequest } from 'next/server';

// Mock environment variables
process.env.DMX_API_KEY = 'test-api-key';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Text API Route', () => {
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

    it('should reject prompt exceeding max length', async () => {
      const req = createRequest({ prompt: 'x'.repeat(8001), model: 'gpt-5-mini' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should accept valid input', async () => {
      const req = createRequest({ prompt: 'Write a poem', model: 'gpt-5-mini' });
      // This will fail at the API call level since we're using a test key
      // but it should pass validation
      const res = await POST(req);
      // Should not be 400 (validation error)
      expect(res.status).not.toBe(400);
    });
  });
});
