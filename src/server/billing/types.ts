import type { BillingEvent } from './subscription-state';

/**
 * Contrato do gateway de pagamento. A implementação do Mercado Pago vem na Fase 6;
 * enquanto BILLING_ENABLED=false, nenhuma rota chama o gateway.
 */
export interface PaymentGateway {
  readonly provider: 'mercadopago';

  /** Cria a assinatura no gateway e devolve a URL de checkout. */
  createCheckout(input: { userId: string; planId: string; payerEmail: string; backUrl: string }): Promise<{
    providerSubscriptionId: string;
    checkoutUrl: string;
  }>;

  cancelSubscription(providerSubscriptionId: string): Promise<void>;

  /** Valida a assinatura HMAC do webhook. Não confia no corpo para nada além do ID. */
  verifyWebhook(input: { headers: Headers; rawBody: string }): Promise<{ eventId: string; resourceId: string; eventType: string }>;

  /** Consulta o recurso na API do gateway e o traduz para um evento normalizado. */
  fetchEvent(input: { resourceId: string; eventType: string }): Promise<{
    providerSubscriptionId: string;
    event: BillingEvent;
    payment?: { providerPaymentId: string; status: string; method: string | null; amountCents: number; paidAt: Date | null };
  }>;
}
