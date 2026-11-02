import type { z } from 'zod';
import { AppError } from './errors';
import type { Logger } from './logger';
import { logger as defaultLogger } from './logger';
import type { Clock, SlidingWindowRateLimiter } from './rate-limiter';
import { systemClock } from './rate-limiter';

export interface HttpClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Tentativas extras para falhas transitórias (rede, 5xx, 429). */
  maxRetries?: number;
  /** Atraso base do backoff exponencial. */
  retryBaseMs?: number;
  rateLimiter?: SlidingWindowRateLimiter;
  /**
   * Chamado antes de cada requisição real (inclusive retentativas), para controle de cota diária.
   * Deve lançar AppError('QUOTA_EXHAUSTED') quando não houver cota.
   */
  beforeRequest?: () => Promise<void>;
  fetchImpl?: typeof fetch;
  clock?: Clock;
  logger?: Logger;
}

export interface HttpClient {
  getJson<T>(path: string, schema: z.ZodType<T>, query?: Record<string, string | number | undefined>): Promise<T>;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    baseUrl,
    headers = {},
    timeoutMs = 15_000,
    maxRetries = 2,
    retryBaseMs = 500,
    rateLimiter,
    beforeRequest,
    fetchImpl = fetch,
    clock = systemClock,
    logger = defaultLogger,
  } = options;

  const log = logger.child({ component: 'http', host: new URL(baseUrl).host });

  async function attempt(url: URL): Promise<unknown> {
    await rateLimiter?.acquire();
    await beforeRequest?.();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = clock.now();
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { accept: 'application/json', ...headers }, signal: controller.signal });
    } catch (cause) {
      throw new AppError('UPSTREAM', `Network error calling ${url.pathname}`, { cause, retryable: true });
    } finally {
      clearTimeout(timer);
    }

    log.debug('http response', { path: url.pathname, status: response.status, ms: clock.now() - started });

    if (!response.ok) {
      throw new AppError('UPSTREAM', `HTTP ${response.status} from ${url.pathname}`, {
        details: { status: response.status },
        retryable: RETRYABLE_STATUS.has(response.status),
      });
    }

    try {
      return await response.json();
    } catch (cause) {
      throw new AppError('UPSTREAM', `Invalid JSON from ${url.pathname}`, { cause });
    }
  }

  return {
    async getJson(path, schema, query) {
      const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }

      let lastError: unknown;
      for (let tryNo = 0; tryNo <= maxRetries; tryNo++) {
        try {
          const json = await attempt(url);
          const parsed = schema.safeParse(json);
          if (!parsed.success) {
            throw new AppError('UPSTREAM', `Unexpected response shape from ${url.pathname}`, {
              details: { issues: parsed.error.issues.slice(0, 5) },
            });
          }
          return parsed.data;
        } catch (error) {
          lastError = error;
          const retryable = error instanceof AppError && error.retryable;
          if (!retryable || tryNo === maxRetries) break;
          const delay = retryBaseMs * 2 ** tryNo;
          log.warn('retrying request', { path: url.pathname, tryNo: tryNo + 1, delayMs: delay });
          await clock.sleep(delay);
        }
      }
      throw lastError;
    },
  };
}
