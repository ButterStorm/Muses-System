import {
  build302SunoPayload,
  buildDmxMinimaxPayload,
  getMusicProvider,
  is302SunoSubmitAccepted,
  parse302SunoFetchResponse,
  parse302SunoSubmitResponse,
  parseDmxMinimaxResponse,
} from '@/lib/musicProviders';

describe('music provider helpers', () => {
  it('routes minimax and suno models to the right providers', () => {
    expect(getMusicProvider('music-2.5')).toBe('dmx-minimax');
    expect(getMusicProvider('suno-v5')).toBe('302-suno');
    expect(getMusicProvider('chirp-fenix')).toBe('302-suno');
  });

  it('builds the DMX minimax responses payload', () => {
    expect(buildDmxMinimaxPayload({
      mode: 'custom',
      prompt: '[verse]\n街灯微亮晚风轻抚',
      title: '雨夜咖啡馆',
      tags: '独立民谣, 忧郁',
      mv: 'music-2.5',
    })).toEqual({
      model: 'music-2.5',
      input: '独立民谣, 忧郁',
      lyrics: '[verse]\n街灯微亮晚风轻抚',
      audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
      output_format: 'url',
      stream: false,
      aigc_watermark: true,
    });
  });

  it('parses the DMX minimax responses output_audio shape', () => {
    expect(parseDmxMinimaxResponse({
      output: [{
        content: [{
          type: 'output_audio',
          audio: 'https://minimax.example/audio.mp3',
        }],
      }],
    })).toEqual([{ audio_url: 'https://minimax.example/audio.mp3', image_url: '' }]);
  });

  it('builds the 302 suno custom payload with required mode fields', () => {
    expect(build302SunoPayload({
      mode: 'custom',
      prompt: '[Verse]\n月光映山河',
      title: '不离不弃',
      tags: 'pop, ballad',
      mv: 'chirp-crow',
    })).toEqual({
      prompt: '[Verse]\n月光映山河',
      title: '不离不弃',
      tags: 'pop, ballad',
      make_instrumental: false,
      mv: 'chirp-crow',
      metadata: { create_mode: 'custom' },
    });
  });

  it('builds the 302 suno inspiration payload', () => {
    expect(build302SunoPayload({
      mode: 'inspiration',
      description: '流行音乐, 雨夜, 咖啡馆',
      makeInstrumental: true,
      mv: 'suno-v5',
    })).toEqual({
      gpt_description_prompt: '流行音乐, 雨夜, 咖啡馆',
      make_instrumental: true,
      mv: 'chirp-crow',
      notify_hook: '',
    });
  });

  it('parses 302 suno submit and fetch responses', () => {
    expect(parse302SunoSubmitResponse({ code: 'success', data: 'task-123' })).toBe('task-123');
    expect(is302SunoSubmitAccepted({ code: 200, message: 'success', data: 'task-123' })).toBe(true);

    expect(parse302SunoFetchResponse({
      data: {
        status: 'SUCCESS',
        data: [{
          audio_url: 'https://suno.example/song.mp3',
          image_url: 'https://suno.example/cover.jpg',
        }],
      },
    })).toEqual({
      status: 'SUCCESS',
      songs: [{
        audio_url: 'https://suno.example/song.mp3',
        image_url: 'https://suno.example/cover.jpg',
      }],
    });
  });

  it('parses alternate 302 suno audio field names', () => {
    expect(parse302SunoFetchResponse({
      data: {
        status: 'SUCCESS',
        data: [{
          audio: 'https://suno.example/song.mp3',
          imageUrl: 'https://suno.example/cover.jpg',
        }],
      },
    }).songs).toEqual([{
      audio_url: 'https://suno.example/song.mp3',
      image_url: 'https://suno.example/cover.jpg',
    }]);
  });

  it('extracts playable songs while the 302 task is still in progress', () => {
    expect(parse302SunoFetchResponse({
      code: 'success',
      data: {
        status: 'IN_PROGRESS',
        progress: '60%',
        data: [
          {
            status: 'complete',
            audio_url: 'https://cdn1.suno.ai/complete.mp3',
            image_large_url: 'https://cdn1.suno.ai/complete-large.png',
          },
          {
            status: 'streaming',
            audio_url: 'https://audiopipe.suno.ai/?item_id=streaming',
            image_url: 'https://cdn1.suno.ai/streaming.png',
          },
        ],
      },
    })).toEqual({
      status: 'IN_PROGRESS',
      songs: [
        {
          audio_url: 'https://cdn1.suno.ai/complete.mp3',
          image_url: 'https://cdn1.suno.ai/complete-large.png',
        },
        {
          audio_url: 'https://audiopipe.suno.ai/?item_id=streaming',
          image_url: 'https://cdn1.suno.ai/streaming.png',
        },
      ],
    });
  });
});
