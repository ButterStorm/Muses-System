import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn';

// 输入验证 schema
const VideoGenerationSchema = z.object({
  provider: z.enum(['kling', 'doubao']),
  prompt: z.string().min(1).max(4000),
  duration: z.union([z.literal(5), z.literal(10)]).default(5),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  imageUrl: z.string().url().optional(),
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
    const validationResult = VideoGenerationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { provider, prompt, duration, aspectRatio, imageUrl } = validationResult.data;

    let videoUrl: string;

    if (provider === 'kling') {
      videoUrl = await generateKlingVideo(prompt, duration, aspectRatio, imageUrl);
    } else if (provider === 'doubao') {
      videoUrl = await generateDoubaoVideo(prompt, duration, aspectRatio, imageUrl);
    } else {
      return NextResponse.json(
        { error: '不支持的视频提供商' },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: videoUrl });
  } catch (error) {
    console.error('[Video API] Error:', error);

    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      const errorMessage = data?.error?.message || error.message || '视频生成失败';
      return NextResponse.json(
        { error: errorMessage },
        { status: error.response?.status || 500 }
      );
    }

    const message = error instanceof Error ? error.message : '视频生成失败';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function generateKlingVideo(
  prompt: string,
  duration: 5 | 10,
  aspectRatio: '9:16' | '16:9' | '1:1',
  imageUrl?: string
): Promise<string> {
  const isImage2Video = !!imageUrl;
  const model = isImage2Video ? 'kling-v2-6-image2video' : 'kling-v2-6-text2video';

  const payload: Record<string, unknown> = {
    model,
    input: prompt,
    negative_prompt: '',
    mode: 'pro',
    sound: 'on',
    aspect_ratio: aspectRatio,
    duration,
  };

  if (isImage2Video) {
    payload.image = imageUrl;
    payload.image_tail = '';
  }

  const response = await axios.post(
    `${DMX_BASE_URL}/v1/responses`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${DMX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    }
  );

  const body = response.data;
  const errCode = body?.error?.code || '';
  const isKlingSuccess = body?.code === 0 || errCode === 'dmxapi_kling_error_0' || body?.message === 'SUCCEED';

  if (response.status >= 400 && !isKlingSuccess) {
    const msg = body?.error?.message || body?.message || JSON.stringify(body);
    throw new Error(`可灵提交失败: ${msg}`);
  }

  const taskId = body?.data?.task_id;
  if (!taskId) {
    throw new Error('可灵提交失败: 无法提取任务ID');
  }

  // 轮询结果（最大 10 分钟）
  const getModel = isImage2Video ? 'kling-image2video-get' : 'kling-text2video-get';
  const maxTotalTime = 10 * 60 * 1000;
  const startTime = Date.now();
  let attempt = 0;
  while (Date.now() - startTime < maxTotalTime) {
    const delay = Math.min(5000 * Math.pow(1.2, attempt), 15000);
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
    try {
      const videoUrl = await pollKlingStream(taskId, getModel);
      if (videoUrl) return videoUrl;
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('生成失败')) throw e;
      continue;
    }
  }
  throw new Error('可灵生成超时');
}

async function pollKlingStream(taskId: string, model: string): Promise<string | null> {
  const response = await fetch(`${DMX_BASE_URL}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DMX_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      input: taskId,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: unknown = null;

  const read = async (): Promise<string | null> => {
    const { done, value } = await reader.read();
    if (done) {
      if (finalResult) {
        const url = extractKlingVideoUrl(finalResult);
        if (url) return url;
      }
      return null;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('event:')) continue;
      let data = trimmed;
      if (data.startsWith('data: ')) data = data.slice(6);
      if (data === '[DONE]') {
        if (finalResult) {
          const url = extractKlingVideoUrl(finalResult);
          if (url) return url;
        }
        return null;
      }

      try {
        const parsed = JSON.parse(data);
        finalResult = parsed;
        if (parsed.type === 'error' || parsed.error) {
          throw new Error('可灵生成失败');
        }
      } catch {
        // 忽略解析错误
      }
    }
    return read();
  };

  return read();
}

function extractKlingVideoUrl(data: unknown): string | null {
  try {
    const text =
      (data as { response?: { output?: Array<{ content?: Array<{ text?: string }> }> } })?.response
        ?.output?.[0]?.content?.[0]?.text || '';
    const match = text.match(/(https?:\/\/[^\s]+\.mp4[^\s]*)/);
    if (match?.[1]) {
      return match[1].replace(/[\n\r].*$/, '');
    }
  } catch {
    // 忽略错误
  }
  return null;
}

async function generateDoubaoVideo(
  prompt: string,
  duration: 5 | 10,
  ratio: '9:16' | '16:9' | '1:1',
  imageUrl?: string
): Promise<string> {
  const input: Array<{ type: string; text?: string; image_url?: { url: string }; role?: string }> = [
    { type: 'text', text: prompt },
  ];

  if (imageUrl) {
    input.push({
      type: 'image_url',
      image_url: { url: imageUrl },
      role: 'first_frame',
    });
  }

  const response = await axios.post(
    `${DMX_BASE_URL}/v1/responses`,
    {
      model: 'doubao-seedance-1-5-pro-responses',
      input,
      generate_audio: true,
      resolution: '1080p',
      ratio,
      duration,
      seed: -1,
      camera_fixed: false,
      watermark: false,
      return_last_frame: false,
    },
    {
      headers: {
        Authorization: `Bearer ${DMX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    }
  );

  const body = response.data;
  const taskId = body?.id;

  if (!taskId) {
    const msg = body?.error?.message || body?.message || JSON.stringify(body);
    throw new Error(`豆包提交失败: ${msg}`);
  }

  // 轮询结果（最大 10 分钟）
  const maxTotalTime = 10 * 60 * 1000;
  const startTime = Date.now();
  let attempt = 0;
  while (Date.now() - startTime < maxTotalTime) {
    const delay = Math.min(5000 * Math.pow(1.2, attempt), 15000);
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
    try {
      const videoUrl = await pollDoubaoStream(taskId);
      if (videoUrl) return videoUrl;
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('生成失败')) throw e;
      continue;
    }
  }
  throw new Error('豆包生成超时');
}

async function pollDoubaoStream(taskId: string): Promise<string | null> {
  const response = await fetch(`${DMX_BASE_URL}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DMX_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'seedance-get',
      input: taskId,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const read = async (): Promise<string | null> => {
    const { done, value } = await reader.read();
    if (done) return null;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('event:')) continue;
      let data = trimmed;
      if (data.startsWith('data: ')) data = data.slice(6);
      if (data === '[DONE]') return null;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'response.completed') {
          const text = parsed.response?.output?.[0]?.content?.[0]?.text || '';
          const match = text.match(/视频URL:\s*(https:\/\/[^\s\n]+)/);
          if (match?.[1]) return match[1];
        }
        if (parsed.type === 'error' || parsed.error) {
          throw new Error('豆包生成失败');
        }
      } catch {
        // 忽略解析错误
      }
    }
    return read();
  };

  return read();
}
