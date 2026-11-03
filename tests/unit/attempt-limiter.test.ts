import { describe, expect, it } from 'vitest';
import { AttemptLimiter } from '@/server/lib/attempt-limiter';

const rule = { name: 'teste', max: 3, windowMs: 60_000 };

describe('limite de tentativas', () => {
  it('libera até o máximo e depois pede para esperar o resto da janela', () => {
    let now = 0;
    const limiter = new AttemptLimiter(() => now);
    expect([1, 2, 3].map(() => limiter.hit(rule, 'ip'))).toEqual([0, 0, 0]);
    now = 15_000;
    expect(limiter.hit(rule, 'ip')).toBe(45);
    now = 60_000;
    expect(limiter.hit(rule, 'ip')).toBe(0);
  });

  it('chaves e regras são independentes; reset zera a contagem', () => {
    const limiter = new AttemptLimiter(() => 0);
    for (let i = 0; i < 3; i++) limiter.hit(rule, 'a');
    expect(limiter.hit(rule, 'a')).toBeGreaterThan(0);
    expect(limiter.hit(rule, 'b')).toBe(0);
    expect(limiter.hit({ ...rule, name: 'outra' }, 'a')).toBe(0);
    limiter.reset(rule, 'a');
    expect(limiter.hit(rule, 'a')).toBe(0);
  });

  it('memória limitada mesmo com muitas chaves (ataque)', () => {
    let now = 0;
    const limiter = new AttemptLimiter(() => now, 100);
    for (let i = 0; i < 1000; i++) limiter.hit(rule, `ip-${i}`);
    expect((limiter as unknown as { hits: Map<string, unknown> }).hits.size).toBeLessThanOrEqual(100);
    now = 1;
    expect(limiter.hit(rule, 'novo')).toBe(0);
  });
});
