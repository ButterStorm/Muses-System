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

function createRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    headers: { authorization: 'Bearer test-token' },
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

    const response = await listFiles(createRequest('/api/agent/sandbox/files?path=/home/user/musesAOS') as never);
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

    const response = await downloadFile(createRequest('/api/agent/sandbox/download?path=/home/user/musesAOS/clip.mp4') as never);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-type')).toContain('video/mp4');
    expect(body).toBe('data');
  });

  it('rejects unsafe sandbox paths', async () => {
    const response = await listFiles(createRequest('/api/agent/sandbox/files?path=/etc/passwd') as never);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('无权访问该沙箱路径');
    expect(mockedGetRequiredSandboxRuntime).not.toHaveBeenCalled();
  });
});
