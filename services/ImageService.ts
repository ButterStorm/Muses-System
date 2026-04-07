import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/api',
});

interface ImageGenerationResponse {
  urls: string[];
}

interface ImageGenerationError {
  error: string;
  details?: unknown;
}

/**
 * 生成图片
 * @param model - 模型名称
 * @param prompt - 提示词
 * @param size - 图片尺寸
 * @param images - 参考图片（用于图生图）
 * @returns 图片 URL 或 URL 数组
 */
export const generateImageWithDmx = async (
  model: string,
  prompt: string,
  size: string = '2K',
  images?: string[]
): Promise<string | string[]> => {
  try {
    const response = await axiosClient.post<ImageGenerationResponse>('/image', {
      model,
      prompt,
      size,
      images,
    });

    const urls = response.data?.urls;
    if (!urls || urls.length === 0) {
      throw new Error('图片生成失败：未返回有效数据');
    }

    return urls.length === 1 ? urls[0] : urls;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as ImageGenerationError | undefined;
      const errorMessage = data?.error || error.message || '图片生成失败';
      throw new Error(errorMessage);
    }
    throw error instanceof Error ? error : new Error('网络异常或未知错误');
  }
};
