import { describe, expect, it, vi } from 'vitest';
import { revalidateSite } from '@/server/ingestion/revalidate-site';
import { createLogger } from '@/server/lib/logger';

const SECRET = 'segredo-de-teste-com-32-caracteres!';

function setup(response: Response | Error = new Response('{}', { status: 200 })) {
  const lines: string[] = [];
  const logger = createLogger({}, { write: (l) => lines.push(l) });
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  return { logger, fetchImpl, lines };
}

describe('aviso de dados novos para o site', () => {
  it('chama /api/revalidate com o segredo no cabeçalho', async () => {
    const { logger, fetchImpl } = setup();
    const ok = await revalidateSite(logger, { NEXT_PUBLIC_SITE_URL: 'https://tabelinha.vercel.app', REVALIDATE_SECRET: SECRET }, fetchImpl);
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://tabelinha.vercel.app/api/revalidate');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ authorization: `Bearer ${SECRET}` });
  });

  it('não chama nada sem segredo, com segredo vazio ou com o site em localhost', async () => {
    const { logger, fetchImpl } = setup();
    for (const env of [
      { NEXT_PUBLIC_SITE_URL: 'https://tabelinha.vercel.app' },
      { NEXT_PUBLIC_SITE_URL: '', REVALIDATE_SECRET: '' },
      { REVALIDATE_SECRET: SECRET },
      { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000', REVALIDATE_SECRET: SECRET },
    ]) {
      expect(await revalidateSite(logger, env, fetchImpl)).toBe(false);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falha do site vira aviso no log, nunca erro', async () => {
    const env = { NEXT_PUBLIC_SITE_URL: 'https://tabelinha.vercel.app', REVALIDATE_SECRET: SECRET };
    for (const response of [new Response('', { status: 401 }), new Error('ECONNREFUSED')]) {
      const { logger, fetchImpl, lines } = setup(response);
      expect(await revalidateSite(logger, env, fetchImpl)).toBe(false);
      expect(lines.join('')).toContain('site revalidation failed');
      expect(lines.join('')).not.toContain(SECRET);
    }
  });
});
