/** @jest-environment node */

import { GET as downloadFile } from '@/app/api/agent/sandbox/download/route';
import { GET as listFiles } from '@/app/api/agent/sandbox/files/route';
import { getRequiredSandboxRuntime } from '@/lib/agents/runtime/manager';
import { getAuthenticatedUserId } from '@/lib/credits';

jest.mock('@/lib/agents/runtime/manager', () => ({
  getRequiredSandboxRuntime: jest.fn(),
}));

jest.mock('@/lib/credits', () => ({
  getAuthenticatedUserId: jest.fn(),
}));

const mockedGetRequiredSandboxRuntime = jest.mocked(getRequiredSandboxRuntime);
const mockedGetAuthenticatedUserId = jest.mocked(getAuthenticatedUserId);

function createRequest(path: string, ip = '203.0.113.10') {
  return new Request(`http://localhost${path}`, {
    headers: {
      authorization: 'Bearer test-token',
      'x-forwarded-for': ip,
    },
  });
}

describe('agent sandbox files API', () => {
  beforeEach(() => {
    mockedGetRequiredSandboxRuntime.mockReset();
    mockedGetAuthenticatedUserId.mockResolvedValue('user_123');
  });

  it('lists sandbox directory entries for the authenticated user runtime', async () => {
    mockedGetRequiredSandboxRuntime.mockResolvedValue({
      id: 'sandbox-1',
      cwd: '/home/user/musesAOS',
      listDir: jest.fn().mockResolvedValue([
        { name: 'out', path: '/home/user/musesAOS/out', type: 'directory', size: 0 },
        { name: 'clip.mp4', path: '/home/user/musesAOS/clip.mp4', type: 'file', size: 12, mimeType: 'video/mp4' },
      ]),
    } as never);

    const response = await listFiles(createRequest('/api/agent/sandbox/files?path=/home/user/musesAOS', '203.0.113.11') as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.entries).toHaveLength(2);
    expect(mockedGetRequiredSandboxRuntime).toHaveBeenCalledWith('user:user_123');
  });

  it('downloads a sandbox file as an attachment', async () => {
    mockedGetRequiredSandboxRuntime.mockResolvedValue({
      id: 'sandbox-1',
      cwd: '/home/user/musesAOS',
      stat: jest.fn().mockResolvedValue({
        name: 'clip.mp4',
        path: '/home/user/musesAOS/clip.mp4',
        type: 'file',
        size: 4,
        mimeType: 'video/mp4',
      }),
      readFile: jest.fn().mockResolvedValue(Buffer.from('data')),
    } as never);

    const response = await downloadFile(createRequest('/api/agent/sandbox/download?path=/home/user/musesAOS/clip.mp4', '203.0.113.12') as never);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-type')).toContain('video/mp4');
    expect(body).toBe('data');
  });

  it('rejects unsafe sandbox paths', async () => {
    const response = await listFiles(createRequest('/api/agent/sandbox/files?path=/etc/passwd', '203.0.113.13') as never);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('无权访问该沙箱路径');
    expect(mockedGetRequiredSandboxRuntime).not.toHaveBeenCalled();
  });

  it('rate limits repeated sandbox directory reads for the same authenticated user', async () => {
    mockedGetRequiredSandboxRuntime.mockResolvedValue({
      id: 'sandbox-1',
      cwd: '/home/user/musesAOS',
      listDir: jest.fn().mockResolvedValue([]),
    } as never);

    let response: Response | undefined;
    for (let i = 0; i < 31; i++) {
      response = await listFiles(createRequest('/api/agent/sandbox/files?path=/home/user/musesAOS', '203.0.113.99') as never);
    }
    const data = await response!.json();

    expect(response!.status).toBe(429);
    expect(data.error).toBe('请求过于频繁');
    expect(response!.headers.get('retry-after')).toBeTruthy();
  });
});
