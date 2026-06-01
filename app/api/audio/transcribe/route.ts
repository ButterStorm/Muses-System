import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';
import { creditErrorResponse, withCreditBilling } from '@/lib/credits';

const AI302_API_KEY = process.env.AI302_API_KEY;
const AI302_BASE_URL = (process.env.AI302_BASE_URL || 'https://api.302ai.com').replace(/\/$/, '');

// 输入验证 schema
const SpeechToTextSchema = z.object({
  model: z.literal('whisper-1').default('whisper-1'),
  language: z.string().optional(),
  responseFormat: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt', 'diarized_json']).default('json'),
});

export async function POST(request: NextRequest) {
  try {
    if (!AI302_API_KEY) {
      return NextResponse.json(
        { error: '服务器配置错误：AI302_API_KEY 未配置' },
        { status: 500 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let file: File | null = null;
    let model = 'whisper-1';
    let language: string | undefined;
    let responseFormat = 'json';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      model = body.model || 'whisper-1';
      language = body.language || undefined;
      responseFormat = body.responseFormat || body.response_format || 'json';
      if (!body.audioUrl || typeof body.audioUrl !== 'string') {
        return NextResponse.json({ error: '请提供音频 URL' }, { status: 400 });
      }
      const mediaUrl = body.audioUrl;
      const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      const mimeType = normalizeMimeType(body.mimeType || (audioResponse.headers['content-type'] as string) || 'audio/mpeg');
      const fileName = typeof body.fileName === 'string' && body.fileName
        ? sanitizeMediaFileName(body.fileName, mimeType)
        : getMediaFileName(mediaUrl, mimeType);
      file = new File([audioResponse.data], fileName, { type: mimeType });
    } else {
      const formData = await request.formData();
      file = formData.get('file') as File | null;
      model = (formData.get('model') as string) || 'whisper-1';
      language = (formData.get('language') as string) || undefined;
      responseFormat = (formData.get('response_format') as string) || 'json';
    }

    if (!file) {
      return NextResponse.json(
        { error: '请提供音频文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/mpga',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的音频或视频格式' },
        { status: 400 }
      );
    }

    // 验证文件大小（最大 25MB）
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: '音频文件大小超过 25MB 限制' },
        { status: 400 }
      );
    }

    const validationResult = SpeechToTextSchema.safeParse({ model, language, responseFormat });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const billedResult = await withCreditBilling(
      request,
      { feature: 'audio_transcribe', model },
      async () => {
        // 构建请求 FormData
        const apiFormData = new FormData();
        apiFormData.append('file', file);
        apiFormData.append('model', model);
        apiFormData.append('response_format', responseFormat);
        if (language) {
          apiFormData.append('language', language);
        }

        const response = await axios.post(
          `${AI302_BASE_URL}/v1/audio/transcriptions`,
          apiFormData,
          {
            headers: {
              Authorization: `Bearer ${AI302_API_KEY}`,
            },
            responseType: 'text',
            transformResponse: [(data) => data],
          }
        );

        const text = normalizeTranscriptionResponse(response.data, responseFormat);

        return { text };
      }
    );

    return NextResponse.json(billedResult);
  } catch (error) {
    const creditResponse = creditErrorResponse(error);
    if (creditResponse) return creditResponse;

    console.error('[Audio Transcribe API] Error:', error);

    if (axios.isAxiosError(error)) {
      const errorMessage = error.message || '语音转文字失败';
      return NextResponse.json(
        { error: errorMessage },
        { status: error.response?.status || 500 }
      );
    }

    const message = error instanceof Error ? error.message : '语音转文字失败';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function normalizeTranscriptionResponse(data: unknown, responseFormat: string): string {
  if (typeof data !== 'string') {
    return JSON.stringify(data, null, 2);
  }

  if (responseFormat === 'json' || responseFormat === 'verbose_json' || responseFormat === 'diarized_json') {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed.text === 'string' && responseFormat === 'json') return parsed.text;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return data;
    }
  }

  return data;
}

function getMediaFileName(mediaUrl: string, mimeType: string): string {
  const extFromUrl = getExtensionFromUrl(mediaUrl);
  const ext = extFromUrl || getExtensionFromMimeType(mimeType);
  return `transcription-input.${ext}`;
}

function sanitizeMediaFileName(fileName: string, mimeType: string): string {
  const safeName = fileName.split(/[\\/]/).pop() || '';
  const hasValidExt = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|mov)$/i.test(safeName);
  const baseName = safeName.replace(/[^\w.\-()\u4e00-\u9fff]/g, '_').slice(0, 120) || 'transcription-input';
  return hasValidExt ? baseName : `${baseName}.${getExtensionFromMimeType(mimeType)}`;
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';')[0].trim();
}

function getExtensionFromUrl(mediaUrl: string): string | null {
  try {
    const pathname = new URL(mediaUrl).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    if (['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'mov'].includes(ext)) {
      return ext;
    }
  } catch {
    return null;
  }

  return null;
}

function getExtensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/x-m4a': 'm4a',
    'audio/mpga': 'mpga',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/mov': 'mov',
  };

  return map[normalized] || 'mp3';
}
