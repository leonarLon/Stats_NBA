export const SUBSCRIPTION_STATUSES = ['trialing', 'pending', 'incomplete', 'active', 'past_due', 'canceled', 'expired'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionAccessFields {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

/**
 * Mesma regra da função SQL public.user_has_access (supabase/migrations/..._accounts_billing.sql).
 * Se mudar uma, mude a outra — o teste de banco em tests/db verifica as duas.
 */
export function subscriptionGrantsAccess(sub: SubscriptionAccessFields, now: Date): boolean {
  if (sub.status === 'trialing') return sub.trialEndsAt !== null && sub.trialEndsAt > now;
  if (sub.status === 'active' || sub.status === 'past_due' || sub.status === 'canceled') {
    return sub.currentPeriodEnd !== null && sub.currentPeriodEnd > now;
  }
  return false;
}

export function hasAccess(subscriptions: SubscriptionAccessFields[], now: Date): boolean {
  return subscriptions.some((s) => subscriptionGrantsAccess(s, now));
}

/** Data em que o acesso atual termina (o maior fim entre as assinaturas que dão acesso). */
export function accessEndsAt(subscriptions: SubscriptionAccessFields[], now: Date): Date | null {
  let end: Date | null = null;
  for (const s of subscriptions) {
    if (!subscriptionGrantsAccess(s, now)) continue;
    const candidate = s.status === 'trialing' ? s.trialEndsAt : s.currentPeriodEnd;
    if (candidate && (!end || candidate > end)) end = candidate;
  }
  return end;
}
