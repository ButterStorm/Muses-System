import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';
import { creditErrorResponse, withCreditBilling } from '@/lib/credits';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn';

// 输入验证 schema
const MusicInspirationSchema = z.object({
  mode: z.literal('inspiration'),
  description: z.string().min(1).max(1000),
  makeInstrumental: z.boolean().default(false),
  mv: z.string().default('chirp-v5'),
});

const MusicCustomSchema = z.object({
  mode: z.literal('custom'),
  prompt: z.string().min(1).max(2000),
  title: z.string().min(1).max(100),
  tags: z.string().max(200).optional(),
  mv: z.string().default('chirp-v5'),
});

const MusicGenerationSchema = z.union([MusicInspirationSchema, MusicCustomSchema]);

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
    const validationResult = MusicGenerationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入验证失败', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    const billedResult = await withCreditBilling(
      request,
      { feature: 'music', model: data.mv },
      async () => {
        let submitPayload: Record<string, unknown>;
        if (data.mode === 'inspiration') {
          submitPayload = {
            gpt_description_prompt: data.description,
            make_instrumental: data.makeInstrumental,
            mv: data.mv,
            notify_hook: '',
          };
        } else {
          submitPayload = {
            prompt: data.prompt,
            title: data.title,
            tags: data.tags,
            mv: data.mv,
          };
        }

        // 提交任务
        const submitResponse = await axios.post(
          `${DMX_BASE_URL}/suno/submit/music`,
          submitPayload,
          {
            headers: {
              Authorization: `Bearer ${DMX_API_KEY}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          }
        );

        if (submitResponse.data?.code !== 'success') {
          throw new Error(submitResponse.data?.message || '任务提交失败');
        }

        const taskId = submitResponse.data?.data;
        if (!taskId) {
          throw new Error('任务 ID 获取失败');
        }

        // 轮询结果
        const maxAttempts = 60;
        const intervalMs = 3000;

        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));

          const statusResponse = await axios.get(
            `${DMX_BASE_URL}/suno/fetch/${taskId}`,
            {
              headers: {
                Authorization: `Bearer ${DMX_API_KEY}`,
              },
            }
          );

          const taskData = statusResponse.data?.data;
          const status = taskData?.status;

          if (status === 'SUCCESS') {
            const songs = taskData?.data || [];
            const result = songs
              .map((song: { audio_url: string; image_url: string }) => ({
                audio_url: song.audio_url,
                image_url: song.image_url,
              }))
              .filter((s: { audio_url: string }) => s.audio_url);

            return { songs: result };
          }

          if (status === 'FAILED') {
            throw new Error('音乐生成失败');
          }
        }

        throw new Error('音乐生成超时');
      }
    );

    return NextResponse.json(billedResult);
  } catch (error) {
    const creditResponse = creditErrorResponse(error);
    if (creditResponse) return creditResponse;

    console.error('[Music API] Error:', error);

    if (axios.isAxiosError(error)) {
      const errorMessage = error.message || '音乐生成失败';
      return NextResponse.json(
        { error: errorMessage },
        { status: error.response?.status || 500 }
      );
    }

    const message = error instanceof Error ? error.message : '音乐生成失败';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
