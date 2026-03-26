import axios from 'axios';

const DMX_API_KEY = process.env.NEXT_PUBLIC_DMX_API_KEY || process.env.NEXT_PUBLIC_302AI_API_KEY;

const jsonHeaders = () => ({
  Authorization: `Bearer ${DMX_API_KEY ?? ''}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const authHeadersOnly = () => ({
  Authorization: `Bearer ${DMX_API_KEY ?? ''}`,
});

const ensureKey = (): void => {
  if (!DMX_API_KEY || DMX_API_KEY.trim().length === 0) {
    throw new Error('DMXAPI 令牌未配置。请在 .env(.local) 中设置 NEXT_PUBLIC_DMX_API_KEY');
  }
};

export interface SunoInspirationOptions {
  gpt_description_prompt: string;
  make_instrumental?: boolean;
  mv?: string;
}

export interface SunoCustomOptions {
  prompt: string;
  title: string;
  tags?: string;
  mv?: string;
}

interface SubmitResponse {
  code: string;
  data: string;
  message: string;
}

interface FetchResponse {
  code: string;
  data: {
    status: string;
    progress: string;
    data?: Array<{
      title: string;
      duration: number;
      audio_url: string;
      image_url: string;
    }>;
  };
  message: string;
}

export const generateMusicInspiration = async (
  description: string,
  options: Partial<SunoInspirationOptions> = {}
): Promise<Array<{ audio_url: string, image_url: string }>> => {
  ensureKey();
  try {
    const response = await axios.post<SubmitResponse>(
      'https://www.dmxapi.cn/suno/submit/music',
      {
        gpt_description_prompt: description,
        make_instrumental: options.make_instrumental || false,
        mv: options.mv || 'chirp-v5',
        notify_hook: '',
      },
      { headers: jsonHeaders() }
    );

    if (response.data?.code !== 'success') {
      throw new Error(response.data?.message || '任务提交失败');
    }

    const taskId = response.data?.data;
    if (!taskId) {
      throw new Error('任务 ID 获取失败');
    }

    const maxAttempts = 60;
    const intervalMs = 3000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      const statusResponse = await axios.get<FetchResponse>(
        `https://www.dmxapi.cn/suno/fetch/${taskId}`,
        { headers: authHeadersOnly() }
      );

      const taskData = statusResponse.data?.data;
      const status = taskData?.status;

      if (status === 'SUCCESS') {
        const songs = taskData?.data || [];
        return songs.map(song => ({
          audio_url: song.audio_url,
          image_url: song.image_url
        })).filter(s => s.audio_url);
      }

      if (status === 'FAILED') {
        throw new Error('音乐生成失败');
      }
    }

    throw new Error('音乐生成超时');
  } catch (error) {
    console.error('[Suno] 音乐生成失败:', error);
    const message = error instanceof Error ? error.message : '音乐生成失败';
    throw new Error(message);
  }
};

export const generateMusicCustom = async (
  prompt: string,
  title: string,
  options: Partial<SunoCustomOptions> = {}
): Promise<Array<{ audio_url: string, image_url: string }>> => {
  ensureKey();
  try {
    const response = await axios.post<SubmitResponse>(
      'https://www.dmxapi.cn/suno/submit/music',
      {
        prompt,
        title,
        tags: options.tags,
        mv: options.mv || 'chirp-v5',
      },
      { headers: jsonHeaders() }
    );

    if (response.data?.code !== 'success') {
      throw new Error(response.data?.message || '任务提交失败');
    }

    const taskId = response.data?.data;
    if (!taskId) {
      throw new Error('任务 ID 获取失败');
    }

    const maxAttempts = 60;
    const intervalMs = 3000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      const statusResponse = await axios.get<FetchResponse>(
        `https://www.dmxapi.cn/suno/fetch/${taskId}`,
        { headers: authHeadersOnly() }
      );

      const taskData = statusResponse.data?.data;
      const status = taskData?.status;

      if (status === 'SUCCESS') {
        const songs = taskData?.data || [];
        return songs.map(song => ({
          audio_url: song.audio_url,
          image_url: song.image_url
        })).filter(s => s.audio_url);
      }

      if (status === 'FAILED') {
        throw new Error('音乐生成失败');
      }
    }

    throw new Error('音乐生成超时');
  } catch (error) {
    console.error('[Suno] 音乐生成失败:', error);
    const message = error instanceof Error ? error.message : '音乐生成失败';
    throw new Error(message);
  }
};

export const getAvailableStyles = () => {
  return [
    'pop', 'rock', 'electronic', 'classical', 'jazz',
    'hip-hop', 'r&b', 'country', 'folk', 'blues',
    'reggae', 'latin', 'ambient', 'cinematic', 'lo-fi',
    'trap', 'house', 'techno', 'dubstep', 'romantic',
    'upbeat', 'melancholic', 'energetic', 'peaceful', 'dramatic'
  ];
};
