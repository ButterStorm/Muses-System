import axios from 'axios';

const DMX_API_KEY = process.env.NEXT_PUBLIC_DMX_API_KEY || process.env.NEXT_PUBLIC_302AI_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn/v1';
const DMX_DoubaoTextModel = process.env.NEXT_PUBLIC_DMX_DOUDAO_TEXT_MODEL || 'doubao-1.6-chat';

const axiosClient = axios.create({ baseURL: DMX_BASE_URL });

const buildHeaders = (): Record<string, string> => {
  return {
    Authorization: `Bearer ${DMX_API_KEY ?? ''}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
};

const ensureApiKeyConfigured = (): void => {
  if (!DMX_API_KEY || DMX_API_KEY.trim().length === 0) {
    throw new Error('DMXAPI 令牌未配置。请在 .env(.local) 中设置 NEXT_PUBLIC_DMX_API_KEY');
  }
};

interface ChatCompletionsResponse {
  choices: Array<{
    message: { content: string };
  }>;
  model: string;
}

export const generateTextWithDmx = async (prompt: string, model: string): Promise<string> => {
  ensureApiKeyConfigured();
  const resolvedModel = model === 'doubao' ? DMX_DoubaoTextModel : model;

  const requestBody: any = {
    model: resolvedModel,
    messages: [{ role: 'user', content: prompt }],
  };

  if (resolvedModel.startsWith('gemini-3')) {
    requestBody.reasoning_effort = 'low';
  }

  try {
    const resp = await axiosClient.post<ChatCompletionsResponse>(
      '/chat/completions',
      requestBody,
      {
        headers: buildHeaders(),
        timeout: 120000
      }
    );
    const content = resp.data?.choices?.[0]?.message?.content ?? '';
    if (!content || content.trim().length === 0) {
      throw new Error('返回内容为空');
    }
    return content;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      if (status === 401 || status === 403) {
        throw new Error('授权失败，请检查 DMXAPI 令牌');
      }
      if (status === 404) {
        throw new Error('接口未找到，请确认 baseUrl 与路径是否正确');
      }
      if (status === 429) {
        throw new Error('请求过于频繁，请稍后重试');
      }
      throw new Error((data as any)?.error?.message || (error.message ?? '请求失败'));
    }
    throw new Error('网络异常或未知错误');
  }
};
