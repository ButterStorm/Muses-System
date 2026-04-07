import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';
import { uploadBuffer } from '@/lib/serverStorage';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn';

// 输入验证 schema
const TextToSpeechSchema = z.object({
  text: z.string().min(1).max(5000),
  model: z.string().default('speech-2.6-hd'),
  voice: z.string().default('male-qn-qingse'),
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
    const validationResult = TextToSpeechSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { text, model, voice } = validationResult.data;

    // 调用 DMX API
    const response = await axios.post(
      `${DMX_BASE_URL}/v1/audio/speech`,
      {
        model,
        input: text,
        voice,
      },
      {
        headers: {
          Authorization: `Bearer ${DMX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    const audioBuffer = response.data as ArrayBuffer;
    const url = await uploadBuffer(audioBuffer, 'audio/mpeg', 'mp3');

    return NextResponse.json({ url });
  } catch (error) {
    console.error('[Audio Speech API] Error:', error);

    if (axios.isAxiosError(error)) {
      const errorMessage = error.message || '语音合成失败';
      return NextResponse.json(
        { error: errorMessage },
        { status: error.response?.status || 500 }
      );
    }

    const message = error instanceof Error ? error.message : '语音合成失败';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
