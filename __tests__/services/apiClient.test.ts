import axios from 'axios';
import { API_TIMEOUTS, createApiClient } from '@/services/apiClient';

jest.mock('axios', () => ({
  create: jest.fn(() => ({ post: jest.fn(), get: jest.fn() })),
}));

describe('createApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates clients with explicit base URL and timeout', () => {
    createApiClient(API_TIMEOUTS.video);

    expect(axios.create).toHaveBeenCalledWith({
      baseURL: '/api',
      timeout: API_TIMEOUTS.video,
    });
  });

  it('keeps long-running video requests longer than standard requests', () => {
    expect(API_TIMEOUTS.video).toBeGreaterThan(API_TIMEOUTS.standard);
    expect(API_TIMEOUTS.standard).toBeGreaterThanOrEqual(60_000);
  });
});
