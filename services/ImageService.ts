import axios from 'axios';

const DMX_API_KEY = process.env.NEXT_PUBLIC_DMX_API_KEY || process.env.NEXT_PUBLIC_302AI_API_KEY;

const buildHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${DMX_API_KEY ?? ''}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const ensureApiKeyConfigured = (): void => {
  if (!DMX_API_KEY || DMX_API_KEY.trim().length === 0) {
    throw new Error('DMXAPI 令牌未配置。请在 .env(.local) 中设置 NEXT_PUBLIC_DMX_API_KEY');
  }
};

export const generateImageSeedream5 = async (
  prompt: string,
  size: string = '2K',
  images?: string[]
): Promise<string | string[]> => {
  ensureApiKeyConfigured();
  try {
    const resp = await axios.post(
      'https://www.dmxapi.cn/v1/responses',
      {
        model: 'doubao-seedream-5.0-lite',
        input: prompt,
        image: images && images.length > 0 ? images : undefined,
        sequential_image_generation: 'disabled',
        tools: [{ type: 'web_search' }],
        size,
        stream: false,
        output_format: 'png',
        response_format: 'url',
        watermark: false,
        optimize_prompt_options: { mode: 'standard' },
      },
      { headers: buildHeaders() }
    );

    const data = resp.data as any;
    const urls: string[] = [];

    // 图片编辑/多图融合: output[].image_url.url
    if (Array.isArray(data?.output)) {
      for (const out of data.output) {
        if (out.type === 'image_url' && out.image_url?.url) {
          urls.push(out.image_url.url);
        }
        // 文生图: output[0].content[0].text 含 markdown 图片
        if (out.content) {
          for (const c of out.content) {
            if (c.text) {
              const matches = c.text.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g);
              for (const m of matches) {
                if (m[1]) urls.push(m[1]);
              }
            }
          }
        }
      }
    }

    if (urls.length > 0) {
      return urls.length === 1 ? urls[0] : urls;
    }

    throw new Error(`图片生成失败：未返回有效数据`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as any;
      throw new Error(data?.error?.message || error.message || '图片生成失败');
    }
    throw error instanceof Error ? error : new Error('网络异常或未知错误');
  }
};

export const generateImageNanoBanana = async (
  prompt: string,
  size: string = '1024x1024',
  images?: string[]
): Promise<string> => {
  ensureApiKeyConfigured();
  try {
    const resp = await axios.post(
      'https://www.dmxapi.cn/v1beta/models/gemini-2.5-flash-image',
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { headers: buildHeaders(), responseType: 'arraybuffer' }
    );
    const ct = (resp.headers['content-type'] || resp.headers['Content-Type'] || '').toString();
    if (ct.startsWith('image/')) {
      const buffer = resp.data as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return `data:${ct.split(';')[0]};base64,${btoa(binary)}`;
    }
    throw new Error('图片生成失败');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.message || '图片生成失败');
    }
    throw new Error('网络异常或未知错误');
  }
};

export const generateImageWithDmx = async (
  model: string,
  prompt: string,
  size: string = '2K',
  images?: string[]
): Promise<string | string[]> => {
  if (model.startsWith('doubao-seedream-5')) {
    return generateImageSeedream5(prompt, size, images);
  }
  if (model.startsWith('gemini-2.5-flash-image')) {
    return generateImageNanoBanana(prompt, size, images);
  }
  throw new Error('不支持的图片模型');
};
