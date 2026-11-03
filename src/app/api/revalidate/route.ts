import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { getAppConfig } from '@/server/lib/config';
import { logger } from '@/server/lib/logger';
import { STATS_TAG } from '@/server/stats/tags';

/**
 * Chamado pelo worker de ingestão depois de gravar dados novos.
 * Marca as consultas de estatística como desatualizadas (stale-while-revalidate):
 * a próxima visita recebe a versão em cache e dispara a atualização.
 * Protegido por REVALIDATE_SECRET no cabeçalho Authorization: Bearer <segredo>.
 */
export async function POST(request: Request) {
  const { REVALIDATE_SECRET } = getAppConfig();
  if (!REVALIDATE_SECRET) {
    return Response.json({ error: 'revalidation disabled' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!safeEqual(token, REVALIDATE_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  revalidateTag(STATS_TAG, 'max');
  logger.info('stats revalidated', { component: 'revalidate' });
  return Response.json({ revalidated: true });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
