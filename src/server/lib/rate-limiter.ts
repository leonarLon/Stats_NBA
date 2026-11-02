export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Limitador de janela deslizante: no máximo `limit` chamadas em qualquer intervalo de `windowMs`.
 * As chamadas esperam a vez em ordem (FIFO), nunca são descartadas.
 *
 * Os termos da API-Sports tratam o desrespeito ao limite por minuto como violação grave,
 * por isso o limite configurado deve ser igual ou menor que o do plano.
 */
export class SlidingWindowRateLimiter {
  private readonly timestamps: number[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: Clock = systemClock,
  ) {
    if (limit < 1) throw new Error('limit must be >= 1');
  }

  /** Aguarda até haver vaga na janela e registra a chamada. */
  acquire(): Promise<void> {
    const next = this.queue.then(() => this.waitForSlot());
    // Erros não devem travar a fila das próximas chamadas
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = this.clock.now();
      while (this.timestamps.length > 0 && now - this.timestamps[0] >= this.windowMs) {
        this.timestamps.shift();
      }
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = this.windowMs - (now - this.timestamps[0]);
      await this.clock.sleep(Math.max(waitMs, 1));
    }
  }
}
