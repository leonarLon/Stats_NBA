import { describe, expect, it } from 'vitest';
import { getBillingConfig, getProvidersConfig, isSupabaseConfigured } from '@/server/lib/config';
import { AppError, toErrorResponse } from '@/server/lib/errors';
import { createLogger, redact } from '@/server/lib/logger';

describe('config', () => {
  it('usa fixtures por padrão e respeita o limite por minuto da API-NBA', () => {
    const cfg = getProvidersConfig({ APISPORTS_KEY: 'abcdefghijk' });
    expect(cfg.DATA_PROVIDER_MODE).toBe('fixture');
    expect(cfg.APISPORTS_PER_MINUTE).toBeLessThanOrEqual(10);
    expect(() => getProvidersConfig({ APISPORTS_KEY: 'abcdefghijk', APISPORTS_PER_MINUTE: '11' })).toThrow(AppError);
  });

  it('não expõe valores de variáveis no erro', () => {
    try {
      getProvidersConfig({ APISPORTS_KEY: 'curta' });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('APISPORTS_KEY');
      expect((e as Error).message).not.toContain('curta');
    }
  });

  it('cobrança ligada exige credenciais do Mercado Pago', () => {
    expect(getBillingConfig({}).BILLING_ENABLED).toBe(false);
    expect(() => getBillingConfig({ BILLING_ENABLED: 'true' })).toThrow(/MP_ACCESS_TOKEN/);
  });

  it('detecta Supabase não configurado', () => {
    expect(isSupabaseConfigured({})).toBe(false);
    expect(isSupabaseConfigured({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(40) })).toBe(true);
  });
});

describe('erros', () => {
  it('resposta HTTP nunca inclui a mensagem interna', () => {
    const res = toErrorResponse(new AppError('UPSTREAM', 'HTTP 500 from /secret-path'));
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('secret-path');
    expect(toErrorResponse(new Error('boom')).status).toBe(500);
  });
});

describe('logger', () => {
  it('oculta campos sensíveis, inclusive aninhados', () => {
    expect(redact({ user: { email: 'a@b.com', id: 1 }, headers: { Authorization: 'Bearer x' }, apiKey: 'k' })).toEqual({
      user: { email: '[redacted]', id: 1 },
      headers: { Authorization: '[redacted]' },
      apiKey: '[redacted]',
    });
  });

  it('escreve JSON e respeita o nível mínimo', () => {
    const lines: string[] = [];
    const log = createLogger({ job: 'x' }, { minLevel: 'info', write: (l) => lines.push(l) });
    log.debug('oculto');
    log.info('visível', { token: 't' });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ level: 'info', message: 'visível', job: 'x', token: '[redacted]' });
  });
});
