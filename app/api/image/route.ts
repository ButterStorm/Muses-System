import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';
import sharp from 'sharp';
import { uploadBuffer } from '@/lib/serverStorage';
import { creditErrorResponse, withCreditBilling } from '@/lib/credits';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn';
const GPT_IMAGE_MODEL = 'gpt-image-2';

// 输入验证 schema
const ImageGenerationSchema = z.object({
  model: z.enum(['doubao-seedream-5.0-lite', 'gemini-2.5-flash-image', 'gemini-3-pro-image', 'gpt-image-2']),
  prompt: z.string().min(1).max(4000),
  size: z.enum(['1K', '2K', '4K', '1024x1024', '1024x1536', '1536x1024']).default('2K'),
  aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('1:1'),
  images: z.array(z.string().url()).max(6).optional(),
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

    const { model, prompt, size, aspectRatio, images } = validationResult.data;

    const billedResult = await withCreditBilling(
      request,
      { feature: 'image', model, size, referenceCount: images?.length || 0 },
      async () => {
        let result: string | string[];

        if (model.startsWith('doubao-seedream')) {
          result = await generateSeedream5(prompt, size, images);
        } else if (model.startsWith('gemini-')) {
          const geminiModelMap: Record<string, string> = {
            'gemini-2.5-flash-image': 'gemini-2.5-flash-image',
            'gemini-3-pro-image': 'gemini-3-pro-image-preview',
          };
          const geminiModel = geminiModelMap[model] || model;
          result = await generateGeminiImage(geminiModel, prompt, images);
        } else if (model === GPT_IMAGE_MODEL) {
          result = images && images.length > 0
            ? await editGptImage(prompt, size, images)
            : await generateGptImage(prompt, size);
        } else {
          throw new ApiRouteError('不支持的图片模型', 400);
        }

        return { urls: Array.isArray(result) ? result : [result] };
      }
    );

    return NextResponse.json(billedResult);
  } catch (error) {
    const creditResponse = creditErrorResponse(error);
    if (creditResponse) return creditResponse;

    console.error('[Image API] Error:', error);

    if (error instanceof ApiRouteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

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

class ApiRouteError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiRouteError';
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

async function generateGptImage(
  prompt: string,
  size: string
): Promise<string | string[]> {
  const response = await axios.post(
    `${DMX_BASE_URL}/v1/images/generations`,
    {
      model: GPT_IMAGE_MODEL,
      prompt,
      n: 1,
      size: normalizeGptImageSize(size),
      quality: 'high',
    },
    {
      headers: {
        Authorization: `Bearer ${DMX_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 300000,
    }
  );

  return await extractGptImageResults(response.data);
}

async function editGptImage(
  prompt: string,
  size: string,
  images: string[]
): Promise<string | string[]> {
  const formData = new FormData();
  formData.append('model', GPT_IMAGE_MODEL);
  formData.append('prompt', prompt);
  formData.append('size', normalizeGptImageSize(size));
  formData.append('background', 'auto');
  formData.append('quality', 'high');
  formData.append('output_format', 'png');
  formData.append('n', '1');

  for (const imageUrl of images.slice(0, 6)) {
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const mimeType = (imgRes.headers['content-type'] as string) || 'image/png';
    const ext = mimeTypeToExtension(mimeType);
    const blob = new Blob([imgRes.data], { type: mimeType });
    formData.append('image', blob, `reference-${Date.now()}.${ext}`);
  }

  const response = await axios.post(
    `${DMX_BASE_URL}/v1/images/edits`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${DMX_API_KEY}`,
        Accept: 'application/json',
      },
      timeout: 300000,
    }
  );

  return await extractGptImageResults(response.data);
}

async function extractGptImageResults(data: unknown): Promise<string | string[]> {
  const items = (data as { data?: Array<{ b64_json?: string; url?: string }> })?.data;
  if (!items || items.length === 0) {
    throw new Error('图片生成失败：未返回有效数据');
  }

  const urls: string[] = [];

  for (const item of items) {
    if (item.b64_json) {
      const imgBuffer = Buffer.from(item.b64_json, 'base64');
      const uploadedUrl = await uploadBuffer(toArrayBuffer(imgBuffer), 'image/png', 'png');
      urls.push(uploadedUrl);
      continue;
    }

    if (item.url) {
      urls.push(item.url);
    }
  }

  if (urls.length === 0) {
    throw new Error('图片生成失败：响应中无图片数据');
  }

  return urls.length === 1 ? urls[0] : urls;
}

async function generateGeminiImage(
  model: string,
  prompt: string,
  images?: string[]
): Promise<string> {
  const parts: any[] = [{ text: prompt }];

  if (images && images.length > 0) {
    for (const imageUrl of images.slice(0, 6)) {
      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const mimeType = (imgRes.headers['content-type'] as string) || 'image/png';
      const base64 = Buffer.from(imgRes.data, 'binary').toString('base64');
      parts.push({ inlineData: { mimeType, data: base64 } });
    }
  }

  const response = await axios.post(
    `${DMX_BASE_URL}/v1beta/models/${model}:generateContent`,
    {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['Text', 'Image'],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${DMX_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = response.data;

  const candidates = data?.candidates;
  if (!candidates || candidates.length === 0) {
    console.error(`[Gemini ${model}] full response:`, JSON.stringify(data).substring(0, 500));
    throw new Error(`${model} 图片生成失败：无候选结果`);
  }

  for (const candidate of candidates) {
    const cParts = candidate?.content?.parts;
    if (!cParts) continue;
    for (const part of cParts) {
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData?.data) {
        // base64 → Buffer → sharp 压缩 → 上传 Supabase → 返回 URL
        const imgBuffer = Buffer.from(inlineData.data, 'base64');
        const compressed = await compressAndConvert(imgBuffer);
        return await uploadBuffer(compressed, 'image/jpeg', 'jpg');
      }
    }
  }

  console.error(`[Gemini ${model}] response structure:`, JSON.stringify(data, null, 2).substring(0, 800));
  throw new Error(`${model} 图片生成失败：响应中无图片数据`);
}

function normalizeGptImageSize(size: string): string {
  if (size === '1024x1024' || size === '1024x1536' || size === '1536x1024') {
    return size;
  }

  return 'auto';
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buffer.length);
  new Uint8Array(ab).set(buffer);
  return ab;
}

/**
 * 用 sharp 压缩图片到 300KB 以内（和前端 compressImage 逻辑一致）
 */
async function compressAndConvert(buffer: Buffer): Promise<ArrayBuffer> {
  const TARGET_SIZE = 300 * 1024; // 300KB

  let quality = 80;
  let result: Buffer = await sharp(buffer)
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();

  while (result.length > TARGET_SIZE && quality > 10) {
    quality -= 10;
    result = await sharp(buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  }

  // transfer to ArrayBuffer for uploadBuffer
  const ab = new ArrayBuffer(result.length);
  new Uint8Array(ab).set(result);
  return ab;
}
