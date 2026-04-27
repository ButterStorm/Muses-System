import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chat } from '@/lib/agents/muses-agent-sdk/chat';

export const runtime = 'nodejs';

function getSafeErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message.includes('OPENAI_API_KEY')) {
    return 'AI 服务配置异常，请联系管理员';
  }

  return null;
}

// 输入验证 schema
const AgentChatSchema = z.object({
  message: z.string().min(1).max(4000),
  model: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = AgentChatSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { message, model } = validationResult.data;
    const result = await chat({ message, model });

    return NextResponse.json(result);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('[Agent API] Error:', errorName);
    const safeErrorMessage = getSafeErrorMessage(error);

    return NextResponse.json(
      { error: safeErrorMessage || 'AI 助手响应失败，请稍后重试' },
      { status: 500 }
    );
  }
}
