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

interface ImageGenerationsResponse {
  model: string;
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    size?: string;
  }>;
  usage?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}

export const generateImageSeedream4 = async (
  prompt: string,
  size: string = '1024x1024',
  images?: string[]
): Promise<string> => {
  ensureApiKeyConfigured();
  try {
    const resp = await axios.post<ImageGenerationsResponse>(
      'https://www.dmxapi.cn/v1/images/generations',
      {
        model: 'doubao-seedream-4-0-250828',
        prompt,
        image: images && images.length > 0 ? images : undefined,
        sequential_image_generation: images && images.length > 0 ? 'auto' : 'disabled',
        sequential_image_generation_options: images && images.length > 0 ? { max_images: 1 } : undefined,
        response_format: 'b64_json',
        size,
        stream: false,
        watermark: false,
      },
      { headers: buildHeaders() }
    );
    const first = resp.data?.data?.[0];
    if (first?.b64_json) {
      const bin = Uint8Array.from(atob(first.b64_json), c => c.charCodeAt(0));
      const blob = new Blob([bin], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      return url;
    }
    if (first?.url) {
      return first.url;
    }
    throw new Error('图片生成失败：未返回有效数据');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as ImageGenerationsResponse | undefined;
      console.error('[DMXAPI Seedream4] AxiosError', { status, data });
      throw new Error(data?.error?.message || error.message || '图片生成失败');
    }
    throw new Error('网络异常或未知错误');
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
      { headers: { ...buildHeaders() }, responseType: 'arraybuffer' }
    );
    const ct = (resp.headers['content-type'] || resp.headers['Content-Type'] || '').toString();
    if (ct.startsWith('image/')) {
      const blob = new Blob([resp.data as ArrayBuffer], { type: ct.split(';')[0] });
      const url = URL.createObjectURL(blob);
      return url;
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
  size: string = '1024x1024',
  images?: string[]
): Promise<string> => {
  if (model.startsWith('doubao-seedream-4-0')) {
    return generateImageSeedream4(prompt, size, images);
  }
  if (model.startsWith('gemini-2.5-flash-image')) {
    return generateImageNanoBanana(prompt, size, images);
  }
  throw new Error('不支持的图片模型');
};
