import axios from 'axios';

export const API_TIMEOUTS = {
  standard: 120_000,
  media: 240_000,
  video: 420_000,
} as const;

export function createApiClient(timeout: number = API_TIMEOUTS.standard) {
  const client = axios.create({
    baseURL: '/api',
    timeout,
  });

  client.interceptors?.request.use(async (config) => {
    if (typeof window === 'undefined') return config;

    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  return client;
}
