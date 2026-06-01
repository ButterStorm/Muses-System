import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';
import { formatBearerToken, getAi302Config, getDmxConfig } from '@/lib/apiConfig';
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

const SUNO_FETCH_TIMEOUT_MS = 10_000;
const SUNO_MAX_POLL_ATTEMPTS = 60;

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
    const providerConfig = provider === 'dmx-minimax' ? getDmxConfig() : getAi302Config();
    const requiredApiKey = providerConfig.apiKey;

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
          ? await generateDmxMinimaxMusic(data, requiredApiKey, providerConfig.baseUrl)
          : await generate302SunoMusic(data, requiredApiKey, providerConfig.baseUrl);

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

async function generateDmxMinimaxMusic(
  data: z.infer<typeof MusicGenerationSchema>,
  apiKey: string,
  baseUrl: string
) {
  const response = await axios.post(
    `${baseUrl}/v1/responses`,
    buildDmxMinimaxPayload(data),
    {
      headers: {
        Authorization: formatBearerToken(apiKey),
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
  apiKey: string,
  baseUrl: string
) {
  const submitResponse = await axios.post(
    `${baseUrl}/suno/submit/music`,
    build302SunoPayload(data),
    {
      headers: {
        Authorization: formatBearerToken(apiKey),
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

  for (let i = 0; i < SUNO_MAX_POLL_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, getSunoPollDelayMs(i)));

    const statusResponse = await axios.get(
      `${baseUrl}/suno/fetch/${taskId}`,
      {
        headers: {
          Authorization: formatBearerToken(apiKey),
          Accept: 'application/json',
        },
        timeout: SUNO_FETCH_TIMEOUT_MS,
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

function getSunoPollDelayMs(attemptIndex: number): number {
  if (attemptIndex < 12) return 5_000;
  if (attemptIndex < 36) return 10_000;
  return 15_000;
}
