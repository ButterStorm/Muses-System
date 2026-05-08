import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';
import { z } from 'zod';
import { getTextModelTimeoutMs } from '@/lib/textModelTimeout';
import { creditErrorResponse, withCreditBilling } from '@/lib/credits';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn/v1';
const DMX_DOUBAO_TEXT_MODEL = process.env.DMX_DOUBAO_TEXT_MODEL || 'doubao-1.6-chat';

const TextGenerationSchema = z.object({
  prompt: z.string().min(1).max(8000),
  model: z.enum([
    'gpt-5-mini',
    'deepseek-v4-flash',
    'deepseek-v4-pro',
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
    const requestTimeoutMs = getTextModelTimeoutMs(model);

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

    const billedResult = await withCreditBilling(
      request,
      { feature: 'text', model },
      async () => {
        const response = await postJson(
          `${DMX_BASE_URL}/chat/completions`,
          requestBody,
          {
            Authorization: `Bearer ${DMX_API_KEY}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          requestTimeoutMs
        );

        const rawBody = response.body;
        const data = rawBody ? JSON.parse(rawBody) : null;

        if (response.status < 200 || response.status >= 300) {
          if (response.status === 401 || response.status === 403) {
            throw new ApiRouteError('授权失败，请检查 API 配置', 401);
          }
          if (response.status === 429) {
            throw new ApiRouteError('请求过于频繁，请稍后重试', 429);
          }

          const errorMessage =
            data?.error?.message ||
            data?.error ||
            rawBody ||
            `上游模型请求失败 (${response.status})`;

          throw new ApiRouteError(errorMessage, response.status || 500);
        }

        const generatedText = data?.choices?.[0]?.message?.content ?? '';

        if (!generatedText || generatedText.trim().length === 0) {
          throw new ApiRouteError('AI 返回内容为空', 500);
        }

        return { text: generatedText };
      }
    );

    return NextResponse.json(billedResult);
  } catch (error) {
    const creditResponse = creditErrorResponse(error);
    if (creditResponse) return creditResponse;

    if (error instanceof ApiRouteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error('[Text API] Error:', error);

    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return NextResponse.json(
        { error: '模型响应超时，请稍后重试' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}

function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ status: number; body: string }> {
  const target = new URL(url);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(payload).toString(),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 500,
            body: raw,
          });
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

class ApiRouteError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiRouteError';
  }
}
