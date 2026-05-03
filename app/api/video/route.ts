import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com';

type AspectRatio = '9:16' | '16:9' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive';

const urlArraySchema = z.array(z.string().url()).max(10);

// 输入验证 schema
const VideoGenerationSchema = z.object({
  provider: z.enum(['kling', 'doubao', 'seedance-2-0', 'happyhorse']),
  prompt: z.string().min(1).max(4000),
  duration: z.number().int().min(3).max(15).default(5),
  aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:3', '3:4', '21:9', 'adaptive']).default('9:16'),
  imageUrl: z.string().url().optional(),
  imageUrls: urlArraySchema.optional(),
  videoUrls: urlArraySchema.optional(),
  audioUrls: urlArraySchema.optional(),
});

interface ReferenceInputs {
  imageUrl?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
}

interface NormalizedReferences {
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = VideoGenerationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { provider, prompt, duration, aspectRatio, imageUrl, imageUrls, videoUrls, audioUrls } = validationResult.data;
    const references = normalizeReferences({ imageUrl, imageUrls, videoUrls, audioUrls });

    let videoUrl = '';
    if (provider === 'kling') {
      ensureDmxApiKey();
      videoUrl = await generateKlingVideo(prompt, duration, aspectRatio, references.imageUrls[0]);
    } else if (provider === 'doubao') {
      ensureDmxApiKey();
      videoUrl = await generateDoubaoVideo(prompt, duration, aspectRatio, references.imageUrls[0]);
    } else if (provider === 'seedance-2-0') {
      ensureDmxApiKey();
      videoUrl = await generateSeedance20Video(prompt, duration, aspectRatio, references);
    } else {
      ensureDashScopeApiKey();
      videoUrl = await generateHappyHorseVideo(prompt, duration, aspectRatio);
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

function ensureDmxApiKey() {
  if (!DMX_API_KEY) {
    throw new Error('服务器配置错误：DMX_API_KEY 未配置');
  }
}

function ensureDashScopeApiKey() {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('服务器配置错误：DASHSCOPE_API_KEY 未配置');
  }
}

function normalizeReferences(inputs: ReferenceInputs): NormalizedReferences {
  const imageUrls = dedupeUrls([...(inputs.imageUrls || []), ...(inputs.imageUrl ? [inputs.imageUrl] : [])]);
  const videoUrls = dedupeUrls(inputs.videoUrls || []);
  const audioUrls = dedupeUrls(inputs.audioUrls || []);

  return { imageUrls, videoUrls, audioUrls };
}

function dedupeUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)));
}

async function generateKlingVideo(
  prompt: string,
  duration: number,
  aspectRatio: AspectRatio,
  imageUrl?: string
): Promise<string> {
  const isImage2Video = !!imageUrl;
  const model = isImage2Video ? 'kling-v2-6-image2video' : 'kling-v2-6-text2video';
  const klingRatio = toKlingRatio(aspectRatio);
  const klingDuration = Math.min(10, Math.max(5, Math.round(duration)));

  const payload: Record<string, unknown> = {
    model,
    input: prompt,
    negative_prompt: '',
    mode: 'pro',
    sound: 'on',
    aspect_ratio: klingRatio,
    duration: klingDuration,
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

  const getModel = isImage2Video ? 'kling-image2video-get' : 'kling-text2video-get';
  return pollWithTimeout(async () => pollKlingStream(taskId, getModel), '可灵生成超时');
}

function toKlingRatio(ratio: AspectRatio): '9:16' | '16:9' | '1:1' {
  if (ratio === '16:9' || ratio === '1:1' || ratio === '9:16') return ratio;
  return '9:16';
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

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No reader');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: unknown = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return extractVideoUrl(finalResult);
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
        return extractVideoUrl(finalResult);
      }

      const parsed = safeParseJson(data);
      if (!parsed) continue;
      finalResult = parsed;

      if ((parsed as { type?: string }).type === 'error' || (parsed as { error?: unknown }).error) {
        throw new Error('可灵生成失败');
      }

      const url = extractVideoUrl(parsed);
      if (url) return url;
    }
  }
}

async function generateDoubaoVideo(
  prompt: string,
  duration: number,
  ratio: AspectRatio,
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
      ratio: toLegacyDoubaoRatio(ratio),
      duration: Math.min(12, Math.max(4, Math.round(duration))),
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

  return pollWithTimeout(async () => pollDoubaoLegacyStream(taskId), '豆包生成超时');
}

function toLegacyDoubaoRatio(ratio: AspectRatio): '16:9' | '9:16' | '1:1' {
  if (ratio === '16:9' || ratio === '9:16' || ratio === '1:1') return ratio;
  return '16:9';
}

async function pollDoubaoLegacyStream(taskId: string): Promise<string | null> {
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

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No reader');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
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

      const parsed = safeParseJson(data);
      if (!parsed) continue;

      if ((parsed as { type?: string }).type === 'error' || (parsed as { error?: unknown }).error) {
        throw new Error('豆包生成失败');
      }

      const url = extractVideoUrl(parsed);
      if (url) return url;
    }
  }
}

async function generateSeedance20Video(
  prompt: string,
  duration: number,
  ratio: AspectRatio,
  references: NormalizedReferences
): Promise<string> {
  const input: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
  const imageUrls = references.imageUrls.slice(0, 10);
  const videoUrls = references.videoUrls.slice(0, 3);
  const audioUrls = references.audioUrls.slice(0, 3);

  // 按需求：所有图片都作为 reference_image，不使用 first_frame / last_frame
  for (const url of imageUrls) {
    input.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
  }
  for (const url of videoUrls) {
    input.push({ type: 'video_url', video_url: { url }, role: 'reference_video' });
  }
  for (const url of audioUrls) {
    input.push({ type: 'audio_url', audio_url: { url }, role: 'reference_audio' });
  }

  const response = await axios.post(
    `${DMX_BASE_URL}/v1/responses`,
    {
      model: 'doubao-seedance-2-0-260128',
      input,
      generate_audio: true,
      resolution: '720p',
      ratio: imageUrls.length > 0 ? 'adaptive' : ratio,
      duration: Math.min(15, Math.max(4, duration)),
      seed: -1,
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
    const errCode = body?.error?.code as string | undefined;
    const msg = body?.error?.message || body?.message || JSON.stringify(body);
    throw new Error(formatSeedanceError(errCode, msg));
  }
  console.info(`[Video API][Seedance 2.0] 任务已提交 task_id=${taskId}`);

  return pollWithTimeout(
    async () => pollSeedance20(taskId),
    `Seedance 2.0 生成超时（task_id: ${taskId}）`
  );
}

async function generateHappyHorseVideo(
  prompt: string,
  duration: number,
  ratio: AspectRatio
): Promise<string> {
  const happyHorseRatio = toHappyHorseRatio(ratio);
  const happyHorseDuration = Math.min(15, Math.max(3, Math.round(duration)));

  const response = await axios.post(
    `${DASHSCOPE_BASE_URL}/api/v1/services/aigc/video-generation/video-synthesis`,
    {
      model: 'happyhorse-1.0-t2v',
      input: { prompt },
      parameters: {
        resolution: '720P',
        ratio: happyHorseRatio,
        duration: happyHorseDuration,
        watermark: false,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      validateStatus: () => true,
    }
  );

  const body = response.data;
  if (response.status >= 400 || body?.code) {
    const msg = body?.message || body?.error?.message || JSON.stringify(body);
    throw new Error(`HappyHorse 提交失败: ${msg}`);
  }

  const taskId = body?.output?.task_id;
  if (!taskId) {
    const msg = body?.message || JSON.stringify(body);
    throw new Error(`HappyHorse 提交失败: 无法提取任务ID${msg ? ` (${msg})` : ''}`);
  }

  console.info(`[Video API][HappyHorse] 任务已提交 task_id=${taskId}`);
  return pollWithTimeout(
    async () => pollHappyHorse(taskId),
    `HappyHorse 生成超时（task_id: ${taskId}）`
  );
}

function toHappyHorseRatio(ratio: AspectRatio): '16:9' | '9:16' | '1:1' | '4:3' | '3:4' {
  if (ratio === '16:9' || ratio === '9:16' || ratio === '1:1' || ratio === '4:3' || ratio === '3:4') {
    return ratio;
  }
  return '16:9';
}

async function pollHappyHorse(taskId: string): Promise<string | null> {
  const response = await axios.get(
    `${DASHSCOPE_BASE_URL}/api/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      validateStatus: () => true,
    }
  );

  const result = response.data;
  if (response.status >= 400 || result?.code) {
    const msg = result?.message || result?.output?.message || JSON.stringify(result);
    throw new Error(`HappyHorse 查询失败: ${msg}`);
  }

  const output = result?.output as Record<string, unknown> | undefined;
  const status = typeof output?.task_status === 'string' ? output.task_status : null;
  const videoUrl = typeof output?.video_url === 'string' ? sanitizeUrl(output.video_url) : extractVideoUrl(result);
  if (videoUrl) return videoUrl;

  if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
    const code = typeof output?.code === 'string' ? output.code : '';
    const message = typeof output?.message === 'string' ? output.message : JSON.stringify(output || result);
    throw new Error(`HappyHorse 生成失败（status: ${status}${code ? `, code: ${code}` : ''}, task_id: ${taskId}）：${message}`);
  }

  return null;
}

async function pollSeedance20(taskId: string): Promise<string | null> {
  const response = await fetch(`${DMX_BASE_URL}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DMX_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'seedance-2-0-get',
      input: taskId,
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  if (result?.error) {
    const errCode = result?.error?.code as string | undefined;
    const message = result?.error?.message || JSON.stringify(result.error);
    throw new Error(formatSeedanceError(errCode, message, '查询失败'));
  }

  const { status } = extractSeedanceStatus(result);
  const videoUrl = extractVideoUrl(result);
  if (videoUrl) return videoUrl;

  if (status === 'failed' || status === 'expired') {
    throw new Error(`Seedance 2.0 生成失败（status: ${status}, task_id: ${taskId}）`);
  }

  return null;
}

async function pollWithTimeout(
  pollFn: () => Promise<string | null>,
  timeoutMessage: string
): Promise<string> {
  const maxTotalTime = 20 * 60 * 1000;
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < maxTotalTime) {
    const delay = Math.min(5000 * Math.pow(1.2, attempt), 15000);
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
    try {
      const videoUrl = await pollFn();
      if (videoUrl) return videoUrl;
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('生成失败')) throw e;
    }
  }

  throw new Error(timeoutMessage);
}

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractVideoUrl(payload: unknown): string | null {
  if (!payload) return null;

  if (typeof payload === 'string') {
    const parsed = safeParseJson(payload);
    if (parsed) return extractVideoUrl(parsed);
    return matchVideoUrl(payload);
  }

  if (typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const directVideoUrl = record.video_url;
  if (typeof directVideoUrl === 'string') return sanitizeUrl(directVideoUrl);

  const content = record.content as Record<string, unknown> | undefined;
  if (content && typeof content.video_url === 'string') {
    return sanitizeUrl(content.video_url);
  }

  const output = record.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractVideoUrl(item);
      if (url) return url;
    }
  }

  const response = record.response as Record<string, unknown> | undefined;
  if (response) {
    const url = extractVideoUrl(response);
    if (url) return url;
  }

  const messageContent = record.content;
  if (Array.isArray(messageContent)) {
    for (const item of messageContent) {
      const url = extractVideoUrl(item);
      if (url) return url;
    }
  }

  const text = typeof record.text === 'string' ? record.text : '';
  if (text) {
    const fromText = extractVideoUrl(text);
    if (fromText) return fromText;
  }

  const serialized = JSON.stringify(payload);
  return matchVideoUrl(serialized);
}

function extractSeedanceStatus(payload: unknown): { status: string | null } {
  if (!payload || typeof payload !== 'object') return { status: null };

  const record = payload as Record<string, unknown>;
  const output = record.output;
  if (!Array.isArray(output)) return { status: null };

  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;

    for (const c of content) {
      if (!c || typeof c !== 'object') continue;
      const text = (c as Record<string, unknown>).text;
      if (typeof text !== 'string') continue;
      const inner = safeParseJson(text);
      if (!inner || typeof inner !== 'object') continue;
      const status = (inner as Record<string, unknown>).status;
      if (typeof status === 'string') {
        return { status };
      }
    }
  }

  return { status: null };
}

function matchVideoUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"']+\.(mp4|mov|webm)[^\s"']*/i);
  return match?.[0] ? sanitizeUrl(match[0]) : null;
}

function sanitizeUrl(url: string): string {
  return url
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '')
    .replace(/[\n\r].*$/, '');
}

function extractRequestId(message: string): string | null {
  const match = message.match(/Request id:\s*([^\s,]+)/i);
  return match?.[1] || null;
}

function formatSeedanceError(
  code: string | undefined,
  message: string,
  stage: '提交失败' | '查询失败' = '提交失败'
): string {
  if ((code || '').includes('PrivacyInformation')) {
    const requestId = extractRequestId(message);
    return `Seedance 2.0 ${stage}：参考图片疑似包含真人，触发平台风控。请改用非真人图片，或先对人物做遮脸/卡通化后再试。${requestId ? `（request id: ${requestId}）` : ''}`;
  }

  return `Seedance 2.0 ${stage}: ${message}`;
}
