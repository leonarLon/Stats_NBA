/**
 * Limite de tentativas por chave (IP, e-mail) em janela fixa, guardado em memória.
 *
 * As chamadas ao Supabase Auth partem do servidor, então o limite por IP do próprio Supabase
 * enxerga só o IP do servidor: não segura quem testa senhas e pode bloquear todos de uma vez.
 * Este limite conta por visitante. Na Vercel cada instância tem sua memória, então é uma
 * proteção de melhor esforço; um limite global exigiria uma tabela no banco.
 */
export interface AttemptRule {
  /** Prefixo da regra, para separar contagens (ex.: 'login:ip'). */
  name: string;
  max: number;
  windowMs: number;
}

export class AttemptLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly now: () => number = Date.now, private readonly maxKeys = 10_000) {}

  /** Registra uma tentativa. Retorna quantos segundos esperar (0 = liberado). */
  hit(rule: AttemptRule, key: string): number {
    const id = `${rule.name}:${key}`;
    const now = this.now();
    const entry = this.hits.get(id);
    if (!entry || entry.resetAt <= now) {
      this.prune(now);
      this.hits.set(id, { count: 1, resetAt: now + rule.windowMs });
      return 0;
    }
    entry.count++;
    return entry.count > rule.max ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  }

  /** Esquece as tentativas (ex.: login certo zera os erros daquele e-mail). */
  reset(rule: AttemptRule, key: string): void {
    this.hits.delete(`${rule.name}:${key}`);
  }

  private prune(now: number) {
    if (this.hits.size < this.maxKeys) return;
    for (const [id, e] of this.hits) if (e.resetAt <= now) this.hits.delete(id);
    // Ainda cheio (ataque com muitas chaves): descarta as mais antigas
    for (const id of this.hits.keys()) {
      if (this.hits.size < this.maxKeys) break;
      this.hits.delete(id);
    }
  }
}

const MINUTE = 60_000;

export const AUTH_RULES = {
  loginPerIp: { name: 'login:ip', max: 30, windowMs: 15 * MINUTE },
  loginPerEmail: { name: 'login:email', max: 8, windowMs: 15 * MINUTE },
  signupPerIp: { name: 'signup:ip', max: 5, windowMs: 60 * MINUTE },
  resetPerIp: { name: 'reset:ip', max: 5, windowMs: 60 * MINUTE },
  resetPerEmail: { name: 'reset:email', max: 3, windowMs: 60 * MINUTE },
} satisfies Record<string, AttemptRule>;

export const authLimiter = new AttemptLimiter();
