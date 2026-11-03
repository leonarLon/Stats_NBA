import { getAppConfig, type Env } from '../lib/config';
import type { Logger } from '../lib/logger';

/**
 * Avisa o site (/api/revalidate) que há dados novos. Opcional: sem REVALIDATE_SECRET ou com
 * o site em localhost, não faz nada (as páginas também se atualizam sozinhas pelo cacheLife).
 * Uma falha aqui nunca derruba a ingestão: os dados já estão gravados.
 */
export async function revalidateSite(logger: Logger, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const { NEXT_PUBLIC_SITE_URL, REVALIDATE_SECRET } = getAppConfig(env);
  if (!REVALIDATE_SECRET || new URL(NEXT_PUBLIC_SITE_URL).hostname === 'localhost') return false;

  try {
    const res = await fetchImpl(new URL('/api/revalidate', NEXT_PUBLIC_SITE_URL), {
      method: 'POST',
      headers: { authorization: `Bearer ${REVALIDATE_SECRET}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn('site revalidation failed', { status: res.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn('site revalidation failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
