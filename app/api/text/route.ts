import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn/v1';
const DMX_DOUBAO_TEXT_MODEL = process.env.DMX_DOUBAO_TEXT_MODEL || 'doubao-1.6-chat';

const TextGenerationSchema = z.object({
  prompt: z.string().min(1).max(8000),
  model: z.enum([
    'gpt-5-mini',
    'deepseek-chat',
    'kimi-k2.5',
    'doubao',
    'doubao-seed-1-8-251228',
    'gemini-3-flash',
    'gemini-3-pro'
  ]),
  imageUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = TextGenerationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    if (!DMX_API_KEY) {
      return NextResponse.json(
        { error: '服务器配置错误：API Key 未配置' },
        { status: 500 }
      );
    }

    const { prompt, model, imageUrl } = validationResult.data;
    const resolvedModel = (model === 'doubao' || model === 'doubao-seed-1-8-251228') ? DMX_DOUBAO_TEXT_MODEL : model;

    let content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    if (imageUrl) {
      content = [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: prompt },
      ];
    } else {
      content = prompt;
    }

    const requestBody: {
      model: string;
      messages: Array<{ role: string; content: typeof content }>;
      reasoning_effort?: string;
    } = {
      model: resolvedModel,
      messages: [{ role: 'user', content }],
    };

    if (resolvedModel.startsWith('gemini-3')) {
      requestBody.reasoning_effort = 'low';
    }

    const response = await axios.post(
      `${DMX_BASE_URL}/chat/completions`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${DMX_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 120000,
      }
    );

    const generatedText = response.data?.choices?.[0]?.message?.content ?? '';

    if (!generatedText || generatedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'AI 返回内容为空' },
        { status: 500 }
      );
    }

    return NextResponse.json({ text: generatedText });
  } catch (error) {
    console.error('[Text API] Error:', error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: '授权失败，请检查 API 配置' },
          { status: 401 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: '请求过于频繁，请稍后重试' },
          { status: 429 }
        );
      }

      const errorMessage = data?.error?.message || error.message || '请求失败';
      return NextResponse.json(
        { error: errorMessage },
        { status: status || 500 }
      );
    }

    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
