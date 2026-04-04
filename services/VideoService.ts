import axios from 'axios';

const DMX_API_KEY = process.env.NEXT_PUBLIC_DMX_API_KEY || process.env.NEXT_PUBLIC_302AI_API_KEY;

const getBearerAuth = () => {
  const key = DMX_API_KEY ?? '';
  return key.startsWith('Bearer ') ? key : `Bearer ${key}`;
};

const getHeaders = () => ({
  'Authorization': getBearerAuth(),
  'Content-Type': 'application/json',
});

const ensureKey = (): void => {
  if (!DMX_API_KEY || DMX_API_KEY.trim().length === 0) {
    throw new Error('DMXAPI 令牌未配置。请在 .env(.local) 中设置 NEXT_PUBLIC_DMX_API_KEY');
  }
};

// ═══════════════════════════════════════════════════════════════
// 可灵视频生成（responses 接口）
// 文档：kling-video.md
// ═══════════════════════════════════════════════════════════════

export const generateVideoKling = async (
  prompt: string,
  duration: 5 | 10 = 5,
  aspectRatio: '9:16' | '16:9' | '1:1' = '9:16',
  imageUrl?: string
): Promise<string> => {
  ensureKey();
  try {
    const isImage2Video = !!imageUrl;
    const model = isImage2Video ? 'kling-v2-6-image2video' : 'kling-v2-6-text2video';

    // 可灵文档：input 是字符串
    const payload: Record<string, any> = {
      model,
      input: prompt,
      negative_prompt: '',
      mode: 'pro',
      sound: 'off',
      aspect_ratio: aspectRatio,
      duration,
    };
    if (isImage2Video) {
      payload.image = imageUrl;
      payload.image_tail = '';
    }

    console.log('[Kling] 提交参数:', payload);

    // validateStatus: 不让 axios 自动抛错，手动解析响应
    const resp = await axios.post('https://www.dmxapi.cn/v1/responses', payload, {
      headers: getHeaders(),
      validateStatus: () => true,
    });

    const body = resp.data;
    console.log('[Kling] 响应:', JSON.stringify(body, null, 2));

    // 可灵响应格式: { code: 0, message: "SUCCEED", data: { task_id } }
    // 或被包装为: { error: { message: "success", code: "dmxapi_kling_error_0" }, data: { task_id } }
    const errCode = body?.error?.code || '';
    const isKlingSuccess = body?.code === 0 || errCode === 'dmxapi_kling_error_0' || body?.message === 'SUCCEED';

    if (resp.status >= 400 && !isKlingSuccess) {
      const msg = body?.error?.message || body?.message || JSON.stringify(body);
      throw new Error(`可灵提交失败: ${msg}`);
    }

    const taskId = body?.data?.task_id;
    if (!taskId) {
      console.error('[Kling] 无法提取 task_id:', JSON.stringify(body, null, 2));
      throw new Error(`可灵提交失败: 无法提取任务ID`);
    }

    console.log(`[Kling] 任务已提交: ${taskId}`);

    // 轮询结果（流式 SSE）
    const getModel = isImage2Video ? 'kling-image2video-get' : 'kling-text2video-get';
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const videoUrl = await pollKlingStream(taskId, getModel);
        if (videoUrl) return videoUrl;
      } catch (e: any) {
        if (e.message?.includes('生成失败')) throw e;
        continue;
      }
    }
    throw new Error('可灵生成超时');
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// 可灵流式轮询：逐块读取 SSE，收集最后一个 JSON，从 text 中提取 .mp4 URL
const pollKlingStream = (taskId: string, model: string): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    fetch('https://www.dmxapi.cn/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getBearerAuth(),
      },
      body: JSON.stringify({
        model,
        input: taskId,
        stream: true,
      }),
    }).then((resp) => {
      if (!resp.ok) {
        reject(new Error(`HTTP ${resp.status}`));
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) {
        reject(new Error('No reader'));
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: any = null;

      const read = (): Promise<void> => {
        return reader!.read().then(({ done, value }) => {
          if (done) {
            if (finalResult) {
              const url = extractKlingVideoUrl(finalResult);
              if (url) { resolve(url); return; }
            }
            resolve(null);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('event:')) continue;
            let data = trimmed;
            if (data.startsWith('data: ')) data = data.slice(6);
            if (data === '[DONE]') {
              if (finalResult) {
                const url = extractKlingVideoUrl(finalResult);
                if (url) { resolve(url); return; }
              }
              resolve(null);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              finalResult = parsed;
              if (parsed.type === 'error' || parsed.error) {
                reject(new Error('可灵生成失败'));
                return;
              }
            } catch {}
          }
          return read();
        });
      };
      read();
    }).catch(reject);
  });
};

// 可灵：从 response.output[0].content[0].text 中提取 .mp4 URL
const extractKlingVideoUrl = (data: any): string | null => {
  try {
    const text = data?.response?.output?.[0]?.content?.[0]?.text || '';
    const match = text.match(/(https?:\/\/[^\s]+\.mp4[^\s]*)/);
    if (match?.[1]) {
      return match[1].replace(/[\n\r].*$/, '');
    }
  } catch {}
  return null;
};

// ═══════════════════════════════════════════════════════════════
// 豆包视频生成（responses 接口）
// 文档：doubao-video.md
// ═══════════════════════════════════════════════════════════════

export const generateVideoDoubao = async (
  prompt: string,
  ratio: '16:9' | '9:16' | '1:1' = '16:9',
  imageUrl?: string,
  duration: 5 | 10 = 5
): Promise<string> => {
  ensureKey();
  try {
    // 豆包文档：input 是数组
    const input: any[] = [{ type: 'text', text: prompt }];
    if (imageUrl) {
      input.push({
        type: 'image_url',
        image_url: { url: imageUrl },
        role: 'first_frame',
      });
    }

    const payload = {
      model: 'doubao-seedance-1-5-pro-responses',
      input,
      generate_audio: true,
      resolution: '1080p',
      ratio,
      duration,
      seed: -1,
      camera_fixed: false,
      watermark: false,
      return_last_frame: false,
    };

    console.log('[Doubao] 提交参数:', payload);

    // 豆包文档：返回 { id: "cgt-...", usage: {...} }
    const resp = await axios.post('https://www.dmxapi.cn/v1/responses', payload, {
      headers: getHeaders(),
      validateStatus: () => true,
    });

    const body = resp.data;
    console.log('[Doubao] 响应:', JSON.stringify(body, null, 2));

    const taskId = body?.id;
    if (!taskId) {
      const msg = body?.error?.message || body?.message || JSON.stringify(body);
      throw new Error(`豆包提交失败: ${msg}`);
    }

    console.log(`[Doubao] 任务已提交: ${taskId}`);

    // 轮询结果（流式 SSE）
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const videoUrl = await pollDoubaoStream(taskId);
        if (videoUrl) return videoUrl;
      } catch (e: any) {
        if (e.message?.includes('生成失败')) throw e;
        continue;
      }
    }
    throw new Error('豆包生成超时');
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// 豆包流式轮询：监听 response.completed 事件，从 text 中提取 "视频URL:" 后面的链接
const pollDoubaoStream = (taskId: string): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    fetch('https://www.dmxapi.cn/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getBearerAuth(),
      },
      body: JSON.stringify({
        model: 'seedance-get',
        input: taskId,
        stream: true,
      }),
    }).then((resp) => {
      if (!resp.ok) {
        reject(new Error(`HTTP ${resp.status}`));
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) {
        reject(new Error('No reader'));
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';

      const read = (): Promise<void> => {
        return reader!.read().then(({ done, value }) => {
          if (done) {
            resolve(null);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('event:')) continue;
            let data = trimmed;
            if (data.startsWith('data: ')) data = data.slice(6);
            if (data === '[DONE]') { resolve(null); return; }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'response.completed') {
                const text = parsed.response?.output?.[0]?.content?.[0]?.text || '';
                const match = text.match(/视频URL:\s*(https:\/\/[^\s\n]+)/);
                if (match?.[1]) { resolve(match[1]); return; }
              }
              if (parsed.type === 'error' || parsed.error) {
                reject(new Error('豆包生成失败'));
                return;
              }
            } catch {}
          }
          return read();
        });
      };
      read();
    }).catch(reject);
  });
};
