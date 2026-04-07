import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/api',
});

interface TextToSpeechResponse {
  url: string;
}

interface SpeechToTextResponse {
  text: string;
}

interface AudioError {
  error: string;
  details?: unknown;
}

export interface TextToSpeechOptions {
  model: string;
  voice: string;
}

export interface SpeechToTextOptions {
  model?: 'whisper-1';
  language?: string;
}

/**
 * 文本转语音
 * @param text - 要转换的文本
 * @param options - TTS 选项
 * @returns 音频 URL
 */
export const textToSpeech = async (
  text: string,
  options: TextToSpeechOptions = { model: 'speech-2.6-hd', voice: 'male-qn-qingse' }
): Promise<string> => {
  try {
    const response = await axiosClient.post<TextToSpeechResponse>('/audio/speech', {
      text,
      model: options.model,
      voice: options.voice,
    });

    const url = response.data?.url;
    if (!url) {
      throw new Error('语音合成失败：未返回有效 URL');
    }

    return url;
  } catch (error) {
    console.error('[TTS] 语音合成失败:', error);
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as AudioError | undefined;
      const message = data?.error || error.message || '语音合成失败';
      throw new Error(message);
    }
    const message = error instanceof Error ? error.message : '语音合成失败';
    throw new Error(message);
  }
};

/**
 * 语音转文本
 * @param audioFile - 音频文件
 * @param options - STT 选项
 * @returns 转录的文本
 */
export const speechToText = async (
  audioFile: Blob | File,
  options: SpeechToTextOptions = {}
): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', options.model || 'whisper-1');
    if (options.language) {
      formData.append('language', options.language);
    }

    const response = await axiosClient.post<SpeechToTextResponse>('/audio/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data?.text || '';
  } catch (error) {
    console.error('[STT] 语音转文字失败:', error);
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as AudioError | undefined;
      const message = data?.error || error.message || '语音转文字失败';
      throw new Error(message);
    }
    const message = error instanceof Error ? error.message : '语音转文字失败';
    throw new Error(message);
  }
};

/**
 * 批量文本转语音
 * @param texts - 要转换的文本数组
 * @param options - TTS 选项
 * @returns 音频 URL 数组
 */
export const batchTextToSpeech = async (
  texts: string[],
  options: TextToSpeechOptions = { model: 'speech-2.6-hd', voice: 'male-qn-qingse' }
): Promise<string[]> => {
  const promises = texts.map((text) => textToSpeech(text, options));
  return Promise.all(promises);
};

/**
 * 获取可用的音色列表
 * @returns 音色列表
 */
export const getAvailableVoices = () => {
  return [
    { id: 'male-qn-qingse', name: '男声-青涩青年', gender: 'male' },
    { id: 'male-qn-jingying', name: '男声-精英青年', gender: 'male' },
    { id: 'male-qn-badao', name: '男声-霸道青年', gender: 'male' },
    { id: 'male-qn-daxuesheng', name: '男声-大学生青年', gender: 'male' },
    { id: 'female-shaonv', name: '女声-少女', gender: 'female' },
    { id: 'female-yujie', name: '女声-御姐', gender: 'female' },
    { id: 'female-chengshu', name: '女声-成熟女性', gender: 'female' },
    { id: 'female-tianmei', name: '女声-甜美女性', gender: 'female' },
    { id: 'clever_boy', name: '聪明男童', gender: 'male' },
    { id: 'cute_boy', name: '可爱男童', gender: 'male' },
    { id: 'lovely_girl', name: '萌萌女童', gender: 'female' },
  ];
};
