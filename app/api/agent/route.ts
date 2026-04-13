import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const DEEPAGENTS_BASE_URL = 'https://heterocat--deepagents-modal-web.modal.run';

// 输入验证 schema
const AgentChatSchema = z.object({
  message: z.string().min(1).max(4000),
  model: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();

    // 验证输入
    const validationResult = AgentChatSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { message, model } = validationResult.data;

    // 调用 Deep Agents API
    const response = await fetch(`${DEEPAGENTS_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant embedded in a creative canvas application called MusesSystem. You help users with their tasks, answer questions, and provide creative inspiration.'
          },
          { role: 'user', content: message }
        ],
        model: model || 'openai:gpt-4o'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[Agent API] DeepAgents error:', errorData);
      return NextResponse.json(
        { error: 'AI 服务响应失败', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.message?.content || data.content || '无响应';

    return NextResponse.json({ response: content });
  } catch (error) {
    console.error('[Agent API] Error:', error);

    // 避免泄露敏感错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('Error details:', errorMessage);

    return NextResponse.json(
      { error: 'AI 助手响应失败，请稍后重试' },
      { status: 500 }
    );
  }
}
