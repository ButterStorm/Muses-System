import axios from 'axios';
import { API_TIMEOUTS, createApiClient } from './apiClient';

const axiosClient = createApiClient(API_TIMEOUTS.standard);

interface ChatCompletionsResponse {
  text: string;
}

interface ChatCompletionsError {
  error: string;
  details?: unknown;
}

/**
 * 使用服务端 API 路由生成文本
 */
export const generateTextWithDmx = async (
  prompt: string,
  model: string,
  imageUrl?: string
): Promise<string> => {
  try {
    const response = await axiosClient.post<ChatCompletionsResponse>(
      '/text',
      {
        prompt,
        model,
        imageUrl,
      },
    );

    const content = response.data?.text ?? '';
    if (!content || content.trim().length === 0) {
      throw new Error('返回内容为空');
    }
    return content;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as ChatCompletionsError | undefined;

      if (status === 401 || status === 403) {
        throw new Error('授权失败，请检查 API 配置');
      }
      if (status === 429) {
        throw new Error('请求过于频繁，请稍后重试');
      }
      if (status === 400 && data?.error) {
        throw new Error(`输入错误: ${data.error}`);
      }

      throw new Error(data?.error || error.message || '请求失败');
    }
    throw new Error('网络异常或未知错误');
  }
};
