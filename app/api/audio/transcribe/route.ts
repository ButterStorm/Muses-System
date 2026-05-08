import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';
import { creditErrorResponse, withCreditBilling } from '@/lib/credits';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn';

// 输入验证 schema
const SpeechToTextSchema = z.object({
  model: z.literal('whisper-1').default('whisper-1'),
  language: z.string().optional(),
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

    // 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '请提供音频文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的音频格式' },
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

    // 解析其他参数
    const model = (formData.get('model') as string) || 'whisper-1';
    const language = (formData.get('language') as string) || undefined;

    const validationResult = SpeechToTextSchema.safeParse({ model, language });
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
        if (language) {
          apiFormData.append('language', language);
        }

        // 调用 DMX API
        const response = await axios.post(
          `${DMX_BASE_URL}/v1/audio/transcriptions`,
          apiFormData,
          {
            headers: {
              Authorization: `Bearer ${DMX_API_KEY}`,
            },
          }
        );

        const text = response.data?.text || '';

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
