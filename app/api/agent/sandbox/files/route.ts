import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSandboxRuntime } from '@/lib/agents/runtime/manager';
import { assertSafeSandboxPath } from '@/lib/agents/sandbox/files';
import { CreditBillingError, getAuthenticatedUserId } from '@/lib/credits';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = assertSafeSandboxPath(url.searchParams.get('path') || '/home/user/musesAOS');
    const runtimeId = `user:${await getAuthenticatedUserId(request)}`;
    const sandboxRuntime = await getRequiredSandboxRuntime(runtimeId);
    const entries = await sandboxRuntime.listDir(path);
    return NextResponse.json({ path, entries });
  } catch (error) {
    return NextResponse.json({ error: getSandboxFileErrorMessage(error) }, { status: getSandboxFileErrorStatus(error) });
  }
}

function getSandboxFileErrorMessage(error: unknown): string {
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
  return '读取沙箱文件失败';
}

function getSandboxFileErrorStatus(error: unknown): number {
  if (error instanceof Error && error.message.includes('SANDBOX_PATH_FORBIDDEN')) return 403;
  if (error instanceof Error && error.message.includes('AGENT_SANDBOX_NOT_STARTED')) return 409;
  if (error instanceof Error && error.message.includes('AGENT_RUNTIME_NOT_FOUND')) return 409;
  if (error instanceof CreditBillingError) return error.status;
  return 500;
}
