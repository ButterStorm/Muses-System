import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/api',
});

interface VideoGenerationResponse {
  url: string;
}

interface VideoGenerationError {
  error: string;
  details?: unknown;
}

export interface VideoReferenceInputs {
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
}

/**
 * 生成可灵视频
 * @param prompt - 提示词
 * @param duration - 时长（5 或 10 秒）
 * @param aspectRatio - 宽高比
 * @param imageUrl - 可选的首帧图片 URL
 * @returns 视频 URL
 */
export const generateVideoKling = async (
  prompt: string,
  duration: number = 5,
  aspectRatio: '9:16' | '16:9' | '1:1' = '9:16',
  imageUrl?: string
): Promise<string> => {
  try {
    const response = await axiosClient.post<VideoGenerationResponse>('/video', {
      provider: 'kling',
      prompt,
      duration,
      aspectRatio,
      imageUrl,
    });

    const videoUrl = response.data?.url;
    if (!videoUrl) {
      throw new Error('视频生成失败：未返回有效 URL');
    }

    return videoUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as VideoGenerationError | undefined;
      const errorMessage = data?.error || error.message || '视频生成失败';
      throw new Error(errorMessage);
    }
    throw error instanceof Error ? error : new Error('网络异常或未知错误');
  }
};

/**
 * 生成豆包视频
 * @param prompt - 提示词
 * @param ratio - 宽高比
 * @param imageUrl - 可选的首帧图片 URL
 * @param duration - 时长（5 或 10 秒）
 * @returns 视频 URL
 */
export const generateVideoDoubao = async (
  prompt: string,
  ratio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive' = '16:9',
  imageUrl?: string,
  duration: number = 5,
  references?: VideoReferenceInputs
): Promise<string> => {
  try {
    const response = await axiosClient.post<VideoGenerationResponse>('/video', {
      provider: 'doubao',
      prompt,
      duration,
      aspectRatio: ratio,
      imageUrl,
      imageUrls: references?.imageUrls,
      videoUrls: references?.videoUrls,
      audioUrls: references?.audioUrls,
    });

    const videoUrl = response.data?.url;
    if (!videoUrl) {
      throw new Error('视频生成失败：未返回有效 URL');
    }

    return videoUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as VideoGenerationError | undefined;
      const errorMessage = data?.error || error.message || '视频生成失败';
      throw new Error(errorMessage);
    }
    throw error instanceof Error ? error : new Error('网络异常或未知错误');
  }
};

/**
 * 生成豆包 Seedance 2.0 视频（支持多模态参考）
 */
export const generateVideoSeedance20 = async (
  prompt: string,
  options: {
    duration?: number;
    ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive';
    references?: VideoReferenceInputs;
  } = {}
): Promise<string> => {
  const { duration = 5, ratio = '16:9', references } = options;

  try {
    const response = await axiosClient.post<VideoGenerationResponse>('/video', {
      provider: 'seedance-2-0',
      prompt,
      duration,
      aspectRatio: ratio,
      imageUrls: references?.imageUrls,
      videoUrls: references?.videoUrls,
      audioUrls: references?.audioUrls,
      imageUrl: references?.imageUrls?.[0],
    });

    const videoUrl = response.data?.url;
    if (!videoUrl) {
      throw new Error('视频生成失败：未返回有效 URL');
    }

    return videoUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as VideoGenerationError | undefined;
      const errorMessage = data?.error || error.message || '视频生成失败';
      throw new Error(errorMessage);
    }
    throw error instanceof Error ? error : new Error('网络异常或未知错误');
  }
};
