import type { SubscriptionStatus } from '../auth/access';
import { AppError } from '../lib/errors';

/**
 * Transições permitidas da assinatura paga (ARCHITECTURE.md, seção 8.3).
 * O teste grátis é uma assinatura separada: trialing → expired.
 */
const TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  trialing: ['expired'],
  pending: ['active', 'incomplete', 'expired'],
  incomplete: ['pending', 'expired'],
  active: ['active', 'past_due', 'canceled', 'expired'], // active → active = renovação
  past_due: ['active', 'canceled', 'expired'],
  canceled: ['active', 'expired'], // reativação antes do fim do período
  expired: [],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError('VALIDATION', `Invalid subscription transition ${from} → ${to}`, { details: { from, to } });
  }
}

/**
 * Eventos normalizados que o adaptador do gateway produz a partir do webhook
 * depois de confirmar o recurso na API do gateway.
 */
export type BillingEvent =
  | { type: 'payment_approved'; periodStart: Date; periodEnd: Date }
  | { type: 'payment_failed' }
  | { type: 'checkout_abandoned' }
  | { type: 'canceled_by_user' }
  | { type: 'period_ended' };

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** Aplica um evento e devolve o novo estado. Puro: não grava nada. */
export function applyBillingEvent(current: SubscriptionSnapshot, event: BillingEvent, now: Date): SubscriptionSnapshot {
  switch (event.type) {
    case 'payment_approved': {
      if (event.periodEnd <= event.periodStart) {
        throw new AppError('VALIDATION', 'Payment period end must be after start');
      }
      assertTransition(current.status, 'active');
      return { status: 'active', currentPeriodStart: event.periodStart, currentPeriodEnd: event.periodEnd, cancelAtPeriodEnd: false };
    }
    case 'payment_failed':
      if (current.status === 'pending') {
        return { ...current, status: 'incomplete' };
      }
      assertTransition(current.status, 'past_due');
      return { ...current, status: 'past_due' };
    case 'checkout_abandoned':
      assertTransition(current.status, 'incomplete');
      return { ...current, status: 'incomplete' };
    case 'canceled_by_user':
      assertTransition(current.status, 'canceled');
      return { ...current, status: 'canceled', cancelAtPeriodEnd: true };
    case 'period_ended': {
      // Só expira de fato quando o período pago já passou
      if (current.currentPeriodEnd && current.currentPeriodEnd > now) return current;
      assertTransition(current.status, 'expired');
      return { ...current, status: 'expired' };
    }
  }
}
