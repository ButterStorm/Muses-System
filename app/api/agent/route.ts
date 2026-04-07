import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn/v1';
const AGENT_MODEL = process.env.AGENT_MODEL || 'gpt-5-mini';

// 输入验证 schema
const AgentChatSchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  try {
    // 验证 API Key 配置
    if (!DMX_API_KEY) {
      return NextResponse.json(
        { error: '服务器配置错误：API Key 未配置' },
        { status: 500 }
      );
    }

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

    const { message } = validationResult.data;

    // 初始化 ChatOpenAI
    const chatModel = new ChatOpenAI({
      apiKey: DMX_API_KEY,
      configuration: {
        baseURL: DMX_BASE_URL,
      },
      modelName: AGENT_MODEL,
      temperature: 0.7,
    });

    const messages = [
      new SystemMessage(
        'You are a helpful AI assistant embedded in a creative canvas application called MusesSystem. You help users with their tasks, answer questions, and provide creative inspiration.'
      ),
      new HumanMessage(message),
    ];

    const response = await chatModel.invoke(messages);

    let content: string;
    if (typeof response.content === 'string') {
      content = response.content;
    } else {
      content = Array.isArray(response.content)
        ? response.content.map((c) => (c as { text?: string }).text || '').join('')
        : String(response.content);
    }

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
