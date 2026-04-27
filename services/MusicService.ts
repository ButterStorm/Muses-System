import axios from 'axios';
import { API_TIMEOUTS, createApiClient } from './apiClient';

const axiosClient = createApiClient(API_TIMEOUTS.media);

interface MusicGenerationResponse {
  songs: Array<{ audio_url: string; image_url: string }>;
}

interface MusicGenerationError {
  error: string;
  details?: unknown;
}

export interface SunoInspirationOptions {
  gpt_description_prompt: string;
  make_instrumental?: boolean;
  mv?: string;
}

export interface SunoCustomOptions {
  prompt: string;
  title: string;
  tags?: string;
  mv?: string;
}

/**
 * 使用灵感模式生成音乐
 * @param description - 音乐描述
 * @param options - 生成选项
 * @returns 生成的音乐列表
 */
export const generateMusicInspiration = async (
  description: string,
  options: Partial<SunoInspirationOptions> = {}
): Promise<Array<{ audio_url: string; image_url: string }>> => {
  try {
    const response = await axiosClient.post<MusicGenerationResponse>('/music', {
      mode: 'inspiration',
      description,
      makeInstrumental: options.make_instrumental || false,
      mv: options.mv || 'chirp-v5',
    });

    const songs = response.data?.songs || [];
    if (songs.length === 0) {
      throw new Error('音乐生成失败：未返回有效数据');
    }

    return songs;
  } catch (error) {
    console.error('[Suno] 音乐生成失败:', error);
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as MusicGenerationError | undefined;
      const message = data?.error || error.message || '音乐生成失败';
      throw new Error(message);
    }
    const message = error instanceof Error ? error.message : '音乐生成失败';
    throw new Error(message);
  }
};

/**
 * 使用自定义模式生成音乐
 * @param prompt - 音乐提示词
 * @param title - 歌曲标题
 * @param options - 生成选项
 * @returns 生成的音乐列表
 */
export const generateMusicCustom = async (
  prompt: string,
  title: string,
  options: Partial<SunoCustomOptions> = {}
): Promise<Array<{ audio_url: string; image_url: string }>> => {
  try {
    const response = await axiosClient.post<MusicGenerationResponse>('/music', {
      mode: 'custom',
      prompt,
      title,
      tags: options.tags,
      mv: options.mv || 'chirp-v5',
    });

    const songs = response.data?.songs || [];
    if (songs.length === 0) {
      throw new Error('音乐生成失败：未返回有效数据');
    }

    return songs;
  } catch (error) {
    console.error('[Suno] 音乐生成失败:', error);
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as MusicGenerationError | undefined;
      const message = data?.error || error.message || '音乐生成失败';
      throw new Error(message);
    }
    const message = error instanceof Error ? error.message : '音乐生成失败';
    throw new Error(message);
  }
};

/**
 * 获取可用的音乐风格列表
 * @returns 风格列表
 */
export const getAvailableStyles = () => {
  return [
    'pop',
    'rock',
    'electronic',
    'classical',
    'jazz',
    'hip-hop',
    'r&b',
    'country',
    'folk',
    'blues',
    'reggae',
    'latin',
    'ambient',
    'cinematic',
    'lo-fi',
    'trap',
    'house',
    'techno',
    'dubstep',
    'romantic',
    'upbeat',
    'melancholic',
    'energetic',
    'peaceful',
    'dramatic',
  ];
};
