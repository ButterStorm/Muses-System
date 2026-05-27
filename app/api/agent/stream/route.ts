import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resetChatRuntimeContext, startChatSandboxRuntime, streamChat } from '@/lib/agents/muses-agent/chat';
import { getDefaultAgentModel, isAllowedAgentModel } from '@/lib/agents/model-router';
import { CreditBillingError, getAuthenticatedUserId } from '@/lib/credits';
import { disposeAgentRuntime } from '@/lib/agents/runtime/manager';
import type { AgentStreamEvent } from '@/lib/agents/runtime/types';

export const runtime = 'nodejs';

const AgentStreamSchema = z.object({
  runtimeId: z.string().min(1).max(160),
  message: z.string().min(1).max(4000),
  model: z.string().refine(isAllowedAgentModel, '不支持的 Agent 模型').optional(),
});

const RuntimeCloseSchema = z.object({
  runtimeId: z.string().min(1).max(160),
});

const RuntimeStartSchema = z.object({
  runtimeId: z.string().min(1).max(160),
  model: z.string().refine(isAllowedAgentModel, '不支持的 Agent 模型').optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = AgentStreamSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { message, model } = validationResult.data;
    const runtimeId = await getUserRuntimeId(request);
    const encoder = new TextEncoder();
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    let isStreamClosed = false;

    let resolveFirst: () => void = () => undefined;
    let rejectFirst: (error: unknown) => void = () => undefined;
    let firstSettled = false;
    const firstEvent = new Promise<void>((resolve, reject) => {
      resolveFirst = resolve;
      rejectFirst = reject;
    });

    const writeEvent = (event: AgentStreamEvent) => {
      if (isStreamClosed) return;
      controllerRef?.enqueue(encoder.encode(formatSseEvent(event)));
      if (!firstSettled) {
        firstSettled = true;
        resolveFirst();
      }
    };

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
        streamChat({
          runtimeId,
          message,
          model: model || getDefaultAgentModel(),
          onEvent: writeEvent,
        })
          .then(() => {
            if (!isStreamClosed) {
              isStreamClosed = true;
              controller.close();
            }
          })
          .catch((error) => {
            if (!firstSettled) {
              firstSettled = true;
              rejectFirst(error);
              return;
            }
            if (!isStreamClosed) {
              isStreamClosed = true;
              controller.enqueue(
                encoder.encode(formatSseEvent({ type: 'error', error: getSafeErrorMessage(error) }))
              );
              controller.close();
            }
          });
      },
      cancel() {
        isStreamClosed = true;
        controllerRef = null;
      },
    });

    try {
      await firstEvent;
    } catch (error) {
      if (error instanceof Error && error.message.includes('AGENT_RUNTIME_BUSY')) {
        return NextResponse.json(
          { error: 'AI 助手正在处理上一条消息，请稍后再试' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: getSafeErrorStatus(error) });
    }

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: getSafeErrorStatus(error) });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = RuntimeCloseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const runtimeId = await getUserRuntimeId(request);
    await disposeAgentRuntime(runtimeId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: getSafeErrorStatus(error) });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = RuntimeStartSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { model } = validationResult.data;
    const runtimeId = await getUserRuntimeId(request);
    const encoder = new TextEncoder();
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    let isStreamClosed = false;

    let resolveFirst: () => void = () => undefined;
    let rejectFirst: (error: unknown) => void = () => undefined;
    let firstSettled = false;
    const firstEvent = new Promise<void>((resolve, reject) => {
      resolveFirst = resolve;
      rejectFirst = reject;
    });

    const writeEvent = (event: AgentStreamEvent) => {
      if (isStreamClosed) return;
      controllerRef?.enqueue(encoder.encode(formatSseEvent(event)));
      if (!firstSettled) {
        firstSettled = true;
        resolveFirst();
      }
    };

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
        startChatSandboxRuntime({
          runtimeId,
          model: model || getDefaultAgentModel(),
          onEvent: writeEvent,
        })
          .then(() => {
            if (!isStreamClosed) {
              isStreamClosed = true;
              controller.close();
            }
          })
          .catch((error) => {
            if (!firstSettled) {
              firstSettled = true;
              rejectFirst(error);
              return;
            }
            if (!isStreamClosed) {
              isStreamClosed = true;
              controller.enqueue(
                encoder.encode(formatSseEvent({ type: 'error', error: getSafeErrorMessage(error) }))
              );
              controller.close();
            }
          });
      },
      cancel() {
        isStreamClosed = true;
        controllerRef = null;
      },
    });

    try {
      await firstEvent;
    } catch (error) {
      if (error instanceof Error && error.message.includes('AGENT_RUNTIME_BUSY')) {
        return NextResponse.json(
          { error: 'AI 助手正在处理上一条消息，请稍后再试' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: getSafeErrorStatus(error) });
    }

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: getSafeErrorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = RuntimeCloseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const reset = await resetChatRuntimeContext({
      runtimeId: await getUserRuntimeId(request),
      model: getDefaultAgentModel(),
    });
    return NextResponse.json({ ok: true, reset });
  } catch (error) {
    if (error instanceof Error && error.message.includes('AGENT_RUNTIME_BUSY')) {
      return NextResponse.json(
        { error: 'AI 助手正在处理上一条消息，请先停止当前运行' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: getSafeErrorStatus(error) });
  }
}

function formatSseEvent(event: AgentStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

async function getUserRuntimeId(request: NextRequest): Promise<string> {
  const userId = await getAuthenticatedUserId(request);
  return `user:${userId}`;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof CreditBillingError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (
      error.message.includes('AGENT_PROVIDER_CONFIG_MISSING') ||
      error.message.includes('DeepSeek_API_KEY') ||
      error.message.includes('OPENAI_API_KEY') ||
      error.message.includes('sk-')
    ) {
      return 'AI 服务配置异常，请联系管理员';
    }
  }

  return 'AI 助手响应失败，请稍后重试';
}

function getSafeErrorStatus(error: unknown): number {
  if (error instanceof CreditBillingError) {
    return error.status;
  }
  return 500;
}
