import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';
import { creditErrorResponse, withCreditBilling } from '@/lib/credits';
import {
  build302SunoPayload,
  buildDmxMinimaxPayload,
  getMusicProvider,
  is302SunoSubmitAccepted,
  normalizeMusicModel,
  parse302SunoFetchResponse,
  parse302SunoSubmitResponse,
  parseDmxMinimaxResponse,
} from '@/lib/musicProviders';

const DMX_API_KEY = process.env.DMX_API_KEY;
const DMX_BASE_URL = (process.env.DMX_BASE_URL || 'https://www.dmxapi.cn').replace(/\/$/, '');
const AI302_API_KEY = process.env.AI302_API_KEY;
const AI302_BASE_URL = (process.env.AI302_BASE_URL || 'https://api.302ai.com').replace(/\/$/, '');

// 输入验证 schema
const MusicInspirationSchema = z.object({
  mode: z.literal('inspiration'),
  description: z.string().min(1).max(1000),
  makeInstrumental: z.boolean().default(false),
  mv: z.string().default('chirp-crow'),
});

const MusicCustomSchema = z.object({
  mode: z.literal('custom'),
  prompt: z.string().min(1).max(2000),
  title: z.string().min(1).max(100),
  tags: z.string().max(200).optional(),
  mv: z.string().default('chirp-crow'),
});

const MusicGenerationSchema = z.union([MusicInspirationSchema, MusicCustomSchema]);

export async function POST(request: NextRequest) {
  try {
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
    const model = normalizeMusicModel(data.mv);
    const provider = getMusicProvider(model);
    const requiredApiKey = provider === 'dmx-minimax' ? DMX_API_KEY : AI302_API_KEY;

    if (!requiredApiKey) {
      return NextResponse.json(
        { error: provider === 'dmx-minimax' ? '服务器配置错误：DMX_API_KEY 未配置' : '服务器配置错误：AI302_API_KEY 未配置' },
        { status: 500 }
      );
    }

    const billedResult = await withCreditBilling(
      request,
      { feature: 'music', model },
      async () => {
        const songs = provider === 'dmx-minimax'
          ? await generateDmxMinimaxMusic(data, requiredApiKey)
          : await generate302SunoMusic(data, requiredApiKey);

        if (songs.length === 0) {
          throw new Error('音乐生成失败：未返回音频地址');
        }

        return { songs };
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

function formatAuthorizationHeader(apiKey: string): string {
  return apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;
}

async function generateDmxMinimaxMusic(
  data: z.infer<typeof MusicGenerationSchema>,
  apiKey: string
) {
  const response = await axios.post(
    `${DMX_BASE_URL}/v1/responses`,
    buildDmxMinimaxPayload(data),
    {
      headers: {
        Authorization: formatAuthorizationHeader(apiKey),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 600000,
    }
  );

  return parseDmxMinimaxResponse(response.data);
}

async function generate302SunoMusic(
  data: z.infer<typeof MusicGenerationSchema>,
  apiKey: string
) {
  const submitResponse = await axios.post(
    `${AI302_BASE_URL}/suno/submit/music`,
    build302SunoPayload(data),
    {
      headers: {
        Authorization: formatAuthorizationHeader(apiKey),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  if (!is302SunoSubmitAccepted(submitResponse.data)) {
    throw new Error(submitResponse.data?.message || '任务提交失败');
  }

  const taskId = parse302SunoSubmitResponse(submitResponse.data);
  if (!taskId) {
    throw new Error('任务 ID 获取失败');
  }

  const maxAttempts = 120;
  const intervalMs = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const statusResponse = await axios.get(
      `${AI302_BASE_URL}/suno/fetch/${taskId}`,
      {
        headers: {
          Authorization: formatAuthorizationHeader(apiKey),
          Accept: 'application/json',
        },
      }
    );

    const result = parse302SunoFetchResponse(statusResponse.data);

    if (result.songs.length > 0) {
      return result.songs;
    }

    if (result.status === 'SUCCESS' || result.status === 'completed' || result.status === 'COMPLETE') {
      return result.songs;
    }

    if (result.status === 'FAILED' || result.status === 'failed') {
      throw new Error('音乐生成失败');
    }
  }

  throw new Error('音乐生成超时');
}
