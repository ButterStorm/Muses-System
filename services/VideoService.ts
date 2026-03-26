import axios from 'axios';

const DMX_API_KEY = process.env.NEXT_PUBLIC_DMX_API_KEY || process.env.NEXT_PUBLIC_302AI_API_KEY;

const getBearerAuth = () => {
  const key = DMX_API_KEY ?? '';
  return key.startsWith('Bearer ') ? key : `Bearer ${key}`;
};

const getJsonHeaders = () => ({
  'Authorization': getBearerAuth(),
  'Content-Type': 'application/json',
});

const ensureKey = (): void => {
  if (!DMX_API_KEY || DMX_API_KEY.trim().length === 0) {
    throw new Error('DMXAPI 令牌未配置。请在 .env(.local) 中设置 NEXT_PUBLIC_DMX_API_KEY');
  }
};

const requestWithRetry = async (fn: () => Promise<any>, retries = 3) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error.response?.status;
      if ((status === 503 || !error.response) && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const generateVideoKling = async (
  prompt: string,
  duration: 5 | 10 = 5,
  aspectRatio: '9:16' | '16:9' | '1:1' = '9:16'
): Promise<string> => {
  ensureKey();
  try {
    const create = await requestWithRetry(() => axios.post('https://www.dmxapi.cn/kling/v1/videos/text2video', {
      model_name: 'kling-v1-6',
      mode: 'std',
      prompt,
      aspect_ratio: aspectRatio,
      duration,
      cfg_scale: 0.5,
    }, { headers: getJsonHeaders() }));

    const taskId = create.data?.data?.task_id || create.data?.task_id;
    if (!taskId) throw new Error(`可灵提交失败: ${create.data?.message || '未知错误'}`);

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const query = await axios.get(`https://www.dmxapi.cn/kling/v1/videos/text2video/${taskId}`, {
        headers: { 'Authorization': getBearerAuth() }
      });
      const data = query.data?.data || query.data;
      const status = (data?.task_status || data?.status || '').toLowerCase();

      if (status === 'succeed' || status === 'success') {
        return data?.task_result?.videos?.[0]?.url || data?.video_url || data?.url || '';
      }
      if (status === 'failed') throw new Error('可灵生成失败');
    }
    throw new Error('可灵生成超时');
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
};

export const generateVideoSora2 = async (
  prompt: string,
  seconds: 4 | 8 | 12 = 12,
  size: '720x1280' | '1280x720' | '1024x1792' | '1792x1024' = '720x1280'
): Promise<string> => {
  ensureKey();
  try {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('model', 'sora-2');
    formData.append('seconds', String(seconds));
    formData.append('size', size);

    const create = await requestWithRetry(() => axios.post('https://www.dmxapi.cn/v1/videos', formData, {
      headers: { 'Authorization': DMX_API_KEY }
    }));

    const id = create.data?.id;
    if (!id) throw new Error(`Sora2 提交失败`);

    const pollUrl = `https://www.dmxapi.cn/v1/videos/${id}/content`;

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 10000));
      try {
        const resp = await axios.get(pollUrl, {
          headers: { 'Authorization': DMX_API_KEY },
          responseType: 'blob',
          timeout: 30000
        });
        if (resp.status === 200 && (resp.data as Blob).size > 0) {
          return URL.createObjectURL(resp.data);
        }
      } catch (e: any) {
        // Continue polling
      }
    }
    throw new Error('Sora2 生成超时');
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const generateVideoDoubao = async (
  prompt: string,
  ratio: '16:9' | '9:16' | '1:1' = '16:9'
): Promise<string> => {
  ensureKey();
  try {
    const create = await requestWithRetry(() => axios.post('https://www.dmxapi.cn/v1/responses', {
      model: 'doubao-seedance-1-5-pro-responses',
      input: [{ type: 'text', text: prompt }],
      resolution: '1080p',
      ratio: ratio,
      duration: 5,
      watermark: false
    }, { headers: getJsonHeaders() }));

    const taskId = create.data?.id;
    if (!taskId) throw new Error(`豆包提交失败`);

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const query = await axios.post('https://www.dmxapi.cn/v1/responses', {
        model: 'seedance-get',
        input: taskId,
        stream: false
      }, { headers: getJsonHeaders() });

      const responseData = query.data;
      const content = responseData?.response?.output?.[0]?.content?.[0]?.text || '';
      const urlMatch = content.match(/视频URL: (https?:\/\/[^\s\n]+)/);
      if (urlMatch && urlMatch[1]) return urlMatch[1];

      const videoUrl = responseData?.video_url || responseData?.url || responseData?.data?.video_url;
      if (videoUrl) return videoUrl;

      if (responseData?.status === 'failed' || responseData?.type === 'error') {
        throw new Error(`豆包生成失败`);
      }
    }
    throw new Error('豆包生成超时');
  } catch (error: any) {
    throw new Error(error.message);
  }
};
