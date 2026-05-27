import {
  assertSafeSandboxPath,
  getDownloadContentType,
  toSandboxFileEntry,
} from '@/lib/agents/sandbox/files';

describe('sandbox file helpers', () => {
  it('allows configured sandbox workspace paths', () => {
    expect(assertSafeSandboxPath('/home/user/musesAOS')).toBe('/home/user/musesAOS');
    expect(assertSafeSandboxPath('/home/user/musesAOS/out/video.mp4')).toBe('/home/user/musesAOS/out/video.mp4');
    expect(assertSafeSandboxPath('/tmp/result.zip')).toBe('/tmp/result.zip');
  });

  it('rejects path traversal, system paths, and sensitive dotfiles', () => {
    expect(() => assertSafeSandboxPath('/home/user/musesAOS/../.env')).toThrow('SANDBOX_PATH_FORBIDDEN');
    expect(() => assertSafeSandboxPath('/etc/passwd')).toThrow('SANDBOX_PATH_FORBIDDEN');
    expect(() => assertSafeSandboxPath('/home/user/musesAOS/.env')).toThrow('SANDBOX_PATH_FORBIDDEN');
    expect(() => assertSafeSandboxPath('/home/user/musesAOS/out/.secret')).toThrow('SANDBOX_PATH_FORBIDDEN');
  });

  it('maps common download content types', () => {
    expect(getDownloadContentType('clip.mp4')).toBe('video/mp4');
    expect(getDownloadContentType('deck.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(getDownloadContentType('archive.unknown')).toBe('application/octet-stream');
  });

  it('normalizes E2B file entries for the UI', () => {
    expect(toSandboxFileEntry({
      name: 'out',
      path: '/home/user/musesAOS/out',
      type: 'dir' as never,
      size: 0,
      mode: 0,
      permissions: 'rwxr-xr-x',
      owner: 'user',
      group: 'user',
    })).toEqual({
      name: 'out',
      path: '/home/user/musesAOS/out',
      type: 'directory',
      size: 0,
      mimeType: undefined,
    });
  });
});
