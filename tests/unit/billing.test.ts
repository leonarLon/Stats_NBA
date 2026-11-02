import { describe, expect, it } from 'vitest';
import { accessEndsAt, hasAccess, subscriptionGrantsAccess } from '@/server/auth/access';
import { applyBillingEvent, canTransition, type SubscriptionSnapshot } from '@/server/billing/subscription-state';

const now = new Date('2026-11-02T12:00:00Z');
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

describe('regra de acesso', () => {
  it.each([
    ['trialing', inDays(1), null, true],
    ['trialing', inDays(-1), null, false],
    ['active', null, inDays(10), true],
    ['active', null, inDays(-1), false],
    ['past_due', null, inDays(2), true],
    ['canceled', null, inDays(5), true],
    ['canceled', null, inDays(-5), false],
    ['pending', null, inDays(30), false],
    ['incomplete', null, inDays(30), false],
    ['expired', null, inDays(30), false],
  ] as const)('%s (teste até %s, período até %s) → %s', (status, trialEndsAt, currentPeriodEnd, expected) => {
    expect(subscriptionGrantsAccess({ status, trialEndsAt, currentPeriodEnd }, now)).toBe(expected);
  });

  it('teste e assinatura paga somam: o acesso vai até o fim mais distante', () => {
    const subs = [
      { status: 'trialing' as const, trialEndsAt: inDays(2), currentPeriodEnd: null },
      { status: 'active' as const, trialEndsAt: null, currentPeriodEnd: inDays(30) },
    ];
    expect(hasAccess(subs, now)).toBe(true);
    expect(accessEndsAt(subs, now)).toEqual(inDays(30));
  });
});

describe('máquina de estados da assinatura', () => {
  const pending: SubscriptionSnapshot = { status: 'pending', currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };

  it('pagamento aprovado ativa e define o período', () => {
    const next = applyBillingEvent(pending, { type: 'payment_approved', periodStart: now, periodEnd: inDays(30) }, now);
    expect(next).toMatchObject({ status: 'active', currentPeriodEnd: inDays(30) });
  });

  it('falha no primeiro pagamento deixa incompleta; na renovação, past_due', () => {
    expect(applyBillingEvent(pending, { type: 'payment_failed' }, now).status).toBe('incomplete');
    const active = { ...pending, status: 'active' as const, currentPeriodEnd: inDays(3) };
    expect(applyBillingEvent(active, { type: 'payment_failed' }, now).status).toBe('past_due');
  });

  it('cancelada mantém o período pago e só expira depois dele', () => {
    const active = { ...pending, status: 'active' as const, currentPeriodEnd: inDays(10) };
    const canceled = applyBillingEvent(active, { type: 'canceled_by_user' }, now);
    expect(canceled).toMatchObject({ status: 'canceled', cancelAtPeriodEnd: true });
    expect(applyBillingEvent(canceled, { type: 'period_ended' }, now).status).toBe('canceled');
    expect(applyBillingEvent(canceled, { type: 'period_ended' }, inDays(11)).status).toBe('expired');
  });

  it('rejeita transições inválidas', () => {
    const expired = { ...pending, status: 'expired' as const };
    expect(() => applyBillingEvent(expired, { type: 'payment_approved', periodStart: now, periodEnd: inDays(30) }, now)).toThrow(/Invalid subscription transition/);
    expect(canTransition('trialing', 'active')).toBe(false);
  });

  it('rejeita período de pagamento inválido', () => {
    expect(() => applyBillingEvent(pending, { type: 'payment_approved', periodStart: now, periodEnd: now }, now)).toThrow();
  });
});
