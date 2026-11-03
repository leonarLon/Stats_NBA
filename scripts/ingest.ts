/**
 * Worker de ingestão (Node). Uso:
 *   npm run ingest -- schedule              calendário de ontem até +7 dias (diário)
 *   npm run ingest -- tick                  status dos jogos + box scores pendentes (a cada 15 min)
 *   npm run ingest -- backfill <de> <até>   carga histórica (AAAA-MM-DD), continua de onde parou
 *
 * Localmente, lê .env.local. No GitHub Actions, as variáveis vêm dos secrets.
 * Termina com código 0 quando as variáveis não estão configuradas (o cron não fica vermelho
 * antes de os secrets existirem).
 */
import { createPipelineDeps } from '../src/server/ingestion/factory';
import { runBackfillJob, runScheduleJob, runTickJob } from '../src/server/ingestion/pipeline';
import { revalidateSite } from '../src/server/ingestion/revalidate-site';
import { isSupabaseConfigured } from '../src/server/lib/config';
import { logger } from '../src/server/lib/logger';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const trigger = process.env.GITHUB_EVENT_NAME === 'schedule' ? 'cron' : 'manual';

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    logger.warn('Supabase não configurado; nada a fazer', { command });
    return;
  }

  // Dados fictícios nunca vão para o banco real
  if ((process.env.DATA_PROVIDER_MODE ?? 'fixture') !== 'live') {
    throw new Error('DATA_PROVIDER_MODE precisa ser "live" para gravar no Supabase (o modo fixture tem dados fictícios).');
  }

  const deps = createPipelineDeps();
  let changed = false;

  switch (command) {
    case 'schedule': {
      // Calendário e placares podem mudar a classificação e a página de jogos
      const { status } = await runScheduleJob(deps, trigger);
      changed = status !== 'skipped';
      break;
    }
    case 'tick': {
      const { result } = await runTickJob(deps, trigger);
      changed = (result?.changed ?? 0) > 0 || (result?.newlyFinal ?? 0) > 0;
      break;
    }
    case 'backfill': {
      const [from, to] = args;
      if (!DATE.test(from ?? '') || !DATE.test(to ?? '') || from > to) {
        throw new Error('uso: backfill AAAA-MM-DD AAAA-MM-DD');
      }
      const { result } = await runBackfillJob(deps, { from, to }, 40, trigger);
      changed = (result?.changed ?? 0) > 0 || (result?.scheduleGames ?? 0) > 0;
      break;
    }
    default:
      throw new Error(`comando desconhecido: ${command ?? '(vazio)'}. Use schedule, tick ou backfill.`);
  }
  logger.info('requisições externas', deps.metrics?.requests ?? {});
  if (changed && (await revalidateSite(logger))) logger.info('site avisado para atualizar as páginas');
}

main().catch((error) => {
  logger.error('ingest falhou', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
