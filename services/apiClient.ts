import axios from 'axios';

export const API_TIMEOUTS = {
  standard: 120_000,
  media: 240_000,
  video: 420_000,
} as const;

export function createApiClient(timeout: number = API_TIMEOUTS.standard) {
  return axios.create({
    baseURL: '/api',
    timeout,
  });
}
