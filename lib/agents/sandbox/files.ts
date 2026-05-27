import path from 'node:path';
import type { EntryInfo } from 'e2b';
import type { SandboxFileEntry } from './types';

const ALLOWED_ROOTS = [
  '/home/user/musesAOS',
  '/tmp',
];

const SENSITIVE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.npmrc',
  '.netrc',
]);

const CONTENT_TYPES: Record<string, string> = {
  gif: 'image/gif',
  html: 'text/html; charset=utf-8',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain; charset=utf-8',
  wav: 'audio/wav',
  webp: 'image/webp',
  zip: 'application/zip',
};

export function assertSafeSandboxPath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('SANDBOX_PATH_FORBIDDEN');
  }

  const normalized = path.posix.normalize(inputPath);
  const isAllowedRoot = ALLOWED_ROOTS.some((root) => (
    normalized === root || normalized.startsWith(`${root}/`)
  ));
  if (!normalized.startsWith('/') || !isAllowedRoot) {
    throw new Error('SANDBOX_PATH_FORBIDDEN');
  }

  const parts = normalized.split('/').filter(Boolean);
  if (parts.some(isSensitivePathPart)) {
    throw new Error('SANDBOX_PATH_FORBIDDEN');
  }

  return normalized;
}

export function getDownloadContentType(fileNameOrPath: string): string {
  const ext = fileNameOrPath.split('.').pop()?.toLowerCase() || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export function toSandboxFileEntry(entry: EntryInfo): SandboxFileEntry {
  const isDirectory = entry.type === 'dir';
  return {
    name: entry.name,
    path: entry.path,
    type: isDirectory ? 'directory' : 'file',
    size: entry.size || 0,
    mimeType: isDirectory ? undefined : getDownloadContentType(entry.name),
  };
}

export function sortSandboxEntries(entries: SandboxFileEntry[]): SandboxFileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}

function isSensitivePathPart(part: string): boolean {
  if (part === '.' || part === '..') return true;
  if (SENSITIVE_NAMES.has(part.toLowerCase())) return true;
  return part.startsWith('.') && part !== '.well-known';
}
