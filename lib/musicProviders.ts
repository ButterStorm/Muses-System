export type MusicRequest =
  | {
      mode: 'inspiration';
      description: string;
      makeInstrumental: boolean;
      mv: string;
    }
  | {
      mode: 'custom';
      prompt: string;
      title: string;
      tags?: string;
      mv: string;
    };

export interface MusicSong {
  audio_url: string;
  image_url: string;
}

const MINIMAX_MODEL = 'music-2.5';
const DEFAULT_SUNO_MODEL = 'chirp-crow';
const DEFAULT_AUDIO_SETTING = {
  sample_rate: 44100,
  bitrate: 256000,
  format: 'mp3',
} as const;

export function getMusicProvider(model: string): 'dmx-minimax' | '302-suno' {
  return model === MINIMAX_MODEL ? 'dmx-minimax' : '302-suno';
}

export function normalizeMusicModel(model: string | undefined): string {
  return model || DEFAULT_SUNO_MODEL;
}

export function buildDmxMinimaxPayload(request: MusicRequest): Record<string, unknown> {
  if (request.mode === 'custom') {
    return buildMinimaxPayload({
      input: request.tags?.trim() || request.title.trim(),
      lyrics: request.prompt.trim(),
    });
  }

  return buildMinimaxPayload({
    input: request.description.trim(),
    lyrics: request.makeInstrumental ? '[Inst]' : request.description.trim(),
  });
}

export function build302SunoPayload(request: MusicRequest): Record<string, unknown> {
  if (request.mode === 'custom') {
    return {
      prompt: request.prompt,
      title: request.title,
      tags: request.tags,
      make_instrumental: false,
      mv: toSunoModel(request.mv),
      metadata: { create_mode: 'custom' },
    };
  }

  return {
    gpt_description_prompt: request.description,
    make_instrumental: request.makeInstrumental,
    mv: toSunoModel(request.mv),
    notify_hook: '',
  };
}

export function parseDmxMinimaxResponse(response: unknown): MusicSong[] {
  const urls = [
    getStringAtPath(response, ['output', 0, 'content', 0, 'audio']),
    getStringAtPath(response, ['data', 'audio_url']),
    getStringAtPath(response, ['data', 'audio']),
  ].filter((url): url is string => Boolean(url));

  return toSongs(urls);
}

export function parse302SunoSubmitResponse(response: unknown): string | undefined {
  return (
    getStringAtPath(response, ['data']) ||
    getStringAtPath(response, ['data', 'task_id']) ||
    getStringAtPath(response, ['task_id'])
  );
}

export function is302SunoSubmitAccepted(response: unknown): boolean {
  const code = getValueAtPath(response, ['code']);
  const message = getStringAtPath(response, ['message'])?.toLowerCase();

  if (code === undefined || code === null) {
    return true;
  }

  return code === 'success' || code === 0 || code === 200 || message === 'success';
}

export function parse302SunoFetchResponse(response: unknown): {
  status: string | undefined;
  songs: MusicSong[];
} {
  const status = getStringAtPath(response, ['data', 'status']) || getStringAtPath(response, ['status']);
  const rawSongs = getArrayAtPath(response, ['data', 'data']) || getArrayAtPath(response, ['data']) || [];

  return {
    status,
    songs: rawSongs
      .map((song) => ({
        audio_url: getSongAudioUrl(song),
        image_url:
          getStringAtPath(song, ['image_large_url']) ||
          getStringAtPath(song, ['image_url']) ||
          getStringAtPath(song, ['imageUrl']) ||
          '',
      }))
      .filter((song) => song.audio_url),
  };
}

function buildMinimaxPayload({
  input,
  lyrics,
}: {
  input: string;
  lyrics: string;
}): Record<string, unknown> {
  return {
    model: MINIMAX_MODEL,
    input,
    lyrics,
    audio_setting: DEFAULT_AUDIO_SETTING,
    output_format: 'url',
    stream: false,
    aigc_watermark: true,
  };
}

function toSunoModel(model: string): string {
  if (model === 'suno-v5' || model === 'chirp-v5') {
    return DEFAULT_SUNO_MODEL;
  }

  return model;
}

function toSongs(urls: string[]): MusicSong[] {
  return Array.from(new Set(urls)).map((url) => ({
    audio_url: url,
    image_url: '',
  }));
}

function getSongAudioUrl(song: unknown): string {
  return (
    getStringAtPath(song, ['audio_url']) ||
    getStringAtPath(song, ['audioUrl']) ||
    getStringAtPath(song, ['audio']) ||
    getStringAtPath(song, ['source_audio_url']) ||
    ''
  );
}

function getStringAtPath(value: unknown, path: Array<string | number>): string | undefined {
  const current = getValueAtPath(value, path);

  return typeof current === 'string' && current ? current : undefined;
}

function getValueAtPath(value: unknown, path: Array<string | number>): unknown {
  let current = value;

  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    current = (current as Record<string | number, unknown>)[segment];
  }

  return current;
}

function getArrayAtPath(value: unknown, path: Array<string | number>): unknown[] | undefined {
  const current = getValueAtPath(value, path);

  return Array.isArray(current) ? current : undefined;
}
