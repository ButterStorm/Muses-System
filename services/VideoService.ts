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
  duration: 5 | 10 = 5,
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
  ratio: '16:9' | '9:16' | '1:1' = '16:9',
  imageUrl?: string,
  duration: 5 | 10 = 5
): Promise<string> => {
  try {
    const response = await axiosClient.post<VideoGenerationResponse>('/video', {
      provider: 'doubao',
      prompt,
      duration,
      aspectRatio: ratio,
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
