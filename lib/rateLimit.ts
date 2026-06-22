interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

interface PersistentRateLimiterOptions extends RateLimiterOptions {
  prefix: string;
  client?: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;
  };
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions) {
  const attempts = new Map<string, RateLimitEntry>();

  const prune = (now: number) => {
    for (const [key, entry] of attempts.entries()) {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    }
  };

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      prune(now);

      const existing = attempts.get(key);
      const entry = existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowMs };

      if (entry.count >= limit) {
        attempts.set(key, entry);
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(entry.resetAt - now, 0),
        };
      }

      entry.count += 1;
      attempts.set(key, entry);

      return {
        allowed: true,
        remaining: Math.max(limit - entry.count, 0),
        retryAfterMs: Math.max(entry.resetAt - now, 0),
      };
    },
    reset(key?: string) {
      if (key) {
        attempts.delete(key);
        return;
      }
      attempts.clear();
    },
  };
}

export function createPersistentRateLimiter({
  limit,
  windowMs,
  prefix,
  client,
}: PersistentRateLimiterOptions) {
  return {
    async check(key: string): Promise<RateLimitResult> {
      const supabase = client || (await import('@/lib/credits')).getServerSupabaseClient();
      const { data, error } = await supabase.rpc('check_api_rate_limit', {
        p_key: `${prefix}:${key}`,
        p_limit: limit,
        p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
      });

      if (error) {
        throw new Error(error.message || 'Persistent rate limiter failed');
      }

      const row = (Array.isArray(data) ? data[0] : data) as {
        allowed?: boolean;
        remaining?: number;
        retry_after_seconds?: number;
      } | null;

      if (!row || typeof row.allowed !== 'boolean') {
        throw new Error('Persistent rate limiter returned an invalid response');
      }

      return {
        allowed: row.allowed,
        remaining: Number(row.remaining || 0),
        retryAfterMs: Number(row.retry_after_seconds || 0) * 1000,
      };
    },
  };
}
