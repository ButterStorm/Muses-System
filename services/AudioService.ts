import axios from 'axios';

const DMX_API_KEY = process.env.NEXT_PUBLIC_DMX_API_KEY || process.env.NEXT_PUBLIC_302AI_API_KEY;

const jsonHeaders = () => ({
  Authorization: `Bearer ${DMX_API_KEY ?? ''}`,
  'Content-Type': 'application/json',
});

const ensureKey = (): void => {
  if (!DMX_API_KEY || DMX_API_KEY.trim().length === 0) {
    throw new Error('DMXAPI 令牌未配置。请在 .env(.local) 中设置 NEXT_PUBLIC_DMX_API_KEY');
  }
};

export interface TextToSpeechOptions {
  model: string;
  voice: string;
}

export interface SpeechToTextOptions {
  model?: 'whisper-1';
  language?: string;
}

export const textToSpeech = async (
  text: string,
  options: TextToSpeechOptions = { model: 'speech-2.6-hd', voice: 'male-qn-qingse' }
): Promise<string> => {
  ensureKey();
  try {
    const response = await axios.post(
      'https://www.dmxapi.cn/v1/audio/speech',
      {
        model: options.model,
        input: text,
        voice: options.voice,
      },
      {
        headers: jsonHeaders(),
        responseType: 'arraybuffer',
      }
    );

    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('[TTS] 语音合成失败:', error);
    const message = error instanceof Error ? error.message : '语音合成失败';
    throw new Error(message);
  }
};

export const speechToText = async (
  audioFile: Blob | File,
  options: SpeechToTextOptions = {}
): Promise<string> => {
  ensureKey();
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', options.model || 'whisper-1');
    if (options.language) {
      formData.append('language', options.language);
    }

    const response = await axios.post(
      'https://www.dmxapi.cn/v1/audio/transcriptions',
      formData,
      {
        headers: {
          Authorization: `Bearer ${DMX_API_KEY ?? ''}`,
        },
      }
    );

    return response.data?.text || '';
  } catch (error) {
    console.error('[STT] 语音转文字失败:', error);
    const message = error instanceof Error ? error.message : '语音转文字失败';
    throw new Error(message);
  }
};

export const batchTextToSpeech = async (
  texts: string[],
  options: TextToSpeechOptions = { model: 'speech-2.6-hd', voice: 'male-qn-qingse' }
): Promise<string[]> => {
  const promises = texts.map(text => textToSpeech(text, options));
  return Promise.all(promises);
};

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
