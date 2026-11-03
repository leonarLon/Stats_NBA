import { getProvidersConfig, type Env } from '../lib/config';
import { AppError } from '../lib/errors';
import { createHttpClient } from '../lib/http';
import { logger as rootLogger, type Logger } from '../lib/logger';
import { SlidingWindowRateLimiter } from '../lib/rate-limiter';
import { ApiNbaProvider } from '../providers/api-nba/api-nba-provider';
import { BallDontLieProvider } from '../providers/balldontlie/balldontlie-provider';
import { FixtureProvider } from '../providers/fixture/fixture-provider';
import { getSupabaseAdmin } from '../supabase/admin';
import type { PipelineDeps } from './pipeline';
import { supabaseRpc, type Rpc } from './rpc';
import { IngestionStore } from './store';

/** Monta o pipeline a partir das variáveis de ambiente (DATA_PROVIDER_MODE=live|fixture). */
export function createPipelineDeps(options: { env?: Env; rpc?: Rpc; logger?: Logger } = {}): PipelineDeps {
  const env = options.env ?? process.env;
  const config = getProvidersConfig(env);
  const logger = (options.logger ?? rootLogger).child({ component: 'ingestion' });
  const store = new IngestionStore(options.rpc ?? supabaseRpc(getSupabaseAdmin()));
  const metrics = { requests: {} as Record<string, number> };
  const countRequest = (slug: string) => {
    metrics.requests[slug] = (metrics.requests[slug] ?? 0) + 1;
  };

  if (config.DATA_PROVIDER_MODE === 'fixture') {
    const fixture = new FixtureProvider();
    return { store, schedule: fixture, box: fixture, logger, metrics };
  }

  if (!config.BALLDONTLIE_KEY) {
    throw new AppError('CONFIG', 'DATA_PROVIDER_MODE=live requires BALLDONTLIE_KEY');
  }

  const balldontlie = new BallDontLieProvider(
    createHttpClient({
      baseUrl: config.BALLDONTLIE_BASE_URL,
      headers: { Authorization: config.BALLDONTLIE_KEY },
      rateLimiter: new SlidingWindowRateLimiter(config.BALLDONTLIE_PER_MINUTE, 60_000),
      beforeRequest: async () => countRequest('balldontlie'),
      logger,
    }),
  );

  const apiNba = new ApiNbaProvider(
    createHttpClient({
      baseUrl: config.APISPORTS_BASE_URL,
      headers: { 'x-apisports-key': config.APISPORTS_KEY },
      rateLimiter: new SlidingWindowRateLimiter(config.APISPORTS_PER_MINUTE, 60_000),
      // Reserva a cota no banco ANTES de cada requisição real (inclusive retentativas)
      beforeRequest: async () => {
        if (!(await store.consumeQuota('api-nba', config.APISPORTS_DAILY_LIMIT))) {
          throw new AppError('QUOTA_EXHAUSTED', `api-nba daily limit of ${config.APISPORTS_DAILY_LIMIT} reached`);
        }
        countRequest('api-nba');
      },
      logger,
    }),
  );

  return { store, schedule: balldontlie, box: apiNba, logger, metrics };
}
