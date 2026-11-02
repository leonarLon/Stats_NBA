import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '@/server/lib/errors';
import { createHttpClient } from '@/server/lib/http';
import { createLogger } from '@/server/lib/logger';
import { SlidingWindowRateLimiter } from '@/server/lib/rate-limiter';
import { createFakeClock } from '../support/fake-clock';

const silent = createLogger({}, { write: () => {} });
const schema = z.object({ ok: z.boolean() });

function fakeFetch(responses: Array<Response | Error>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('rate limiter', () => {
  it('nunca permite mais que o limite na janela', async () => {
    const clock = createFakeClock();
    const limiter = new SlidingWindowRateLimiter(2, 60_000, clock);
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
      times.push(clock.now());
    }
    expect(times).toEqual([0, 0, 60_000, 60_000, 120_000]);
  });
});

describe('http client', () => {
  it('monta URL com query e valida o schema', async () => {
    const { impl, calls } = fakeFetch([json({ ok: true })]);
    const client = createHttpClient({ baseUrl: 'https://api.test/v2', fetchImpl: impl, logger: silent });
    await expect(client.getJson('/games', schema, { date: '2026-11-01', team: undefined })).resolves.toEqual({ ok: true });
    expect(calls).toEqual(['https://api.test/v2/games?date=2026-11-01']);
  });

  it('tenta de novo em 503 com backoff exponencial', async () => {
    const clock = createFakeClock();
    const { impl, calls } = fakeFetch([json({}, 503), json({}, 503), json({ ok: true })]);
    const client = createHttpClient({ baseUrl: 'https://api.test', fetchImpl: impl, clock, logger: silent, retryBaseMs: 100 });
    await expect(client.getJson('/x', schema)).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(clock.sleeps).toEqual([100, 200]);
  });

  it('não tenta de novo em 404', async () => {
    const { impl, calls } = fakeFetch([json({}, 404)]);
    const client = createHttpClient({ baseUrl: 'https://api.test', fetchImpl: impl, logger: silent });
    await expect(client.getJson('/x', schema)).rejects.toMatchObject({ code: 'UPSTREAM', retryable: false });
    expect(calls).toHaveLength(1);
  });

  it('tenta de novo em erro de rede e desiste após o limite', async () => {
    const clock = createFakeClock();
    const { impl, calls } = fakeFetch([new Error('ECONNRESET'), new Error('ECONNRESET'), new Error('ECONNRESET')]);
    const client = createHttpClient({ baseUrl: 'https://api.test', fetchImpl: impl, clock, logger: silent, maxRetries: 2 });
    await expect(client.getJson('/x', schema)).rejects.toBeInstanceOf(AppError);
    expect(calls).toHaveLength(3);
  });

  it('rejeita resposta com formato inesperado', async () => {
    const { impl } = fakeFetch([json({ ok: 'sim' })]);
    const client = createHttpClient({ baseUrl: 'https://api.test', fetchImpl: impl, logger: silent });
    await expect(client.getJson('/x', schema)).rejects.toThrow(/Unexpected response shape/);
  });

  it('para quando a cota diária acaba, sem chamar a API', async () => {
    const { impl, calls } = fakeFetch([json({ ok: true })]);
    const client = createHttpClient({
      baseUrl: 'https://api.test',
      fetchImpl: impl,
      logger: silent,
      beforeRequest: async () => {
        throw new AppError('QUOTA_EXHAUSTED', 'daily quota reached');
      },
    });
    await expect(client.getJson('/x', schema)).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' });
    expect(calls).toHaveLength(0);
  });

  it('passa cada requisição pelo rate limiter, inclusive retentativas', async () => {
    const clock = createFakeClock();
    const limiter = new SlidingWindowRateLimiter(1, 60_000, clock);
    const { impl } = fakeFetch([json({}, 503), json({ ok: true })]);
    const client = createHttpClient({ baseUrl: 'https://api.test', fetchImpl: impl, clock, logger: silent, rateLimiter: limiter, retryBaseMs: 10 });
    await client.getJson('/x', schema);
    // Segunda tentativa só depois de a janela de 1 minuto liberar
    expect(clock.now()).toBeGreaterThanOrEqual(60_000);
  });
});
