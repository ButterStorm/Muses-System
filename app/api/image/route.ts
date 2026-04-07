import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn';

// 输入验证 schema
const ImageGenerationSchema = z.object({
  model: z.enum(['doubao-seedream-5.0-lite', 'gemini-2.5-flash-image']),
  prompt: z.string().min(1).max(4000),
  size: z.enum(['2K', '1024x1024', '1024x1536', '1536x1024']).default('2K'),
  images: z.array(z.string().url()).max(4).optional(),
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
    const validationResult = ImageGenerationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { model, prompt, size, images } = validationResult.data;

    let result: string | string[];

    if (model.startsWith('doubao-seedream')) {
      result = await generateSeedream5(prompt, size, images);
    } else if (model.startsWith('gemini-2.5-flash-image')) {
      result = await generateNanoBanana(prompt, size);
    } else {
      return NextResponse.json(
        { error: '不支持的图片模型' },
        { status: 400 }
      );
    }

    return NextResponse.json({ urls: Array.isArray(result) ? result : [result] });
  } catch (error) {
    console.error('[Image API] Error:', error);

    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      const errorMessage = data?.error?.message || error.message || '图片生成失败';
      return NextResponse.json(
        { error: errorMessage },
        { status: error.response?.status || 500 }
      );
    }

    const message = error instanceof Error ? error.message : '图片生成失败';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function generateSeedream5(
  prompt: string,
  size: string,
  images?: string[]
): Promise<string | string[]> {
  const response = await axios.post(
    `${DMX_BASE_URL}/v1/responses`,
    {
      model: 'doubao-seedream-5.0-lite',
      input: prompt,
      image: images && images.length > 0 ? images : undefined,
      sequential_image_generation: 'disabled',
      tools: [{ type: 'web_search' }],
      size,
      stream: false,
      output_format: 'png',
      response_format: 'url',
      watermark: false,
      optimize_prompt_options: { mode: 'standard' },
    },
    {
      headers: {
        Authorization: `Bearer ${DMX_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  const data = response.data;
  const urls: string[] = [];

  if (Array.isArray(data?.output)) {
    for (const out of data.output) {
      if (out.type === 'image_url' && out.image_url?.url) {
        urls.push(out.image_url.url);
      }
      if (out.content) {
        for (const c of out.content) {
          if (c.text) {
            const matches = c.text.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g);
            for (const m of matches) {
              if (m[1]) urls.push(m[1]);
            }
          }
        }
      }
    }
  }

  if (urls.length === 0) {
    throw new Error('图片生成失败：未返回有效数据');
  }

  return urls.length === 1 ? urls[0] : urls;
}

async function generateNanoBanana(prompt: string, size: string): Promise<string> {
  const response = await axios.post(
    `${DMX_BASE_URL}/v1beta/models/gemini-2.5-flash-image`,
    {
      contents: [{ parts: [{ text: prompt }] }],
    },
    {
      headers: {
        Authorization: `Bearer ${DMX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    }
  );

  const ct = (response.headers['content-type'] || '').toString();
  if (ct.startsWith('image/')) {
    const buffer = response.data as ArrayBuffer;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:${ct.split(';')[0]};base64,${btoa(binary)}`;
  }

  throw new Error('图片生成失败');
}
