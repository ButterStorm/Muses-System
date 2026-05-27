import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSandboxRuntime } from '@/lib/agents/runtime/manager';
import { assertSafeSandboxPath, getDownloadContentType } from '@/lib/agents/sandbox/files';
import { CreditBillingError, getAuthenticatedUserId } from '@/lib/credits';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const safePath = assertSafeSandboxPath(url.searchParams.get('path') || '');
    const runtimeId = `user:${await getAuthenticatedUserId(request)}`;
    const sandboxRuntime = await getRequiredSandboxRuntime(runtimeId);
    const info = await sandboxRuntime.stat(safePath);
    if (info.type !== 'file') {
      return NextResponse.json({ error: '只能下载文件' }, { status: 400 });
    }

    const data = await sandboxRuntime.readFile(safePath);
    const fileName = path.posix.basename(safePath);
    const encoded = encodeURIComponent(fileName);
    return new Response(data, {
      headers: {
        'Content-Type': info.mimeType || getDownloadContentType(fileName),
        'Content-Length': String(data.byteLength),
        'Content-Disposition': `attachment; filename="${fallbackAsciiFileName(fileName)}"; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getSandboxDownloadErrorMessage(error) }, { status: getSandboxDownloadErrorStatus(error) });
  }
}

function fallbackAsciiFileName(fileName: string): string {
  return fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
}

function getSandboxDownloadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes('SANDBOX_PATH_FORBIDDEN')) {
    return '无权访问该沙箱路径';
  }
  if (error instanceof Error && error.message.includes('AGENT_SANDBOX_NOT_STARTED')) {
    return '请先开启沙箱';
  }
  if (error instanceof Error && error.message.includes('AGENT_RUNTIME_NOT_FOUND')) {
    return '请先开启沙箱';
  }
  if (error instanceof CreditBillingError) {
    return error.message;
  }
  return '下载沙箱文件失败';
}

function getSandboxDownloadErrorStatus(error: unknown): number {
  if (error instanceof Error && error.message.includes('SANDBOX_PATH_FORBIDDEN')) return 403;
  if (error instanceof Error && error.message.includes('AGENT_SANDBOX_NOT_STARTED')) return 409;
  if (error instanceof Error && error.message.includes('AGENT_RUNTIME_NOT_FOUND')) return 409;
  if (error instanceof CreditBillingError) return error.status;
  return 500;
}
