/** Formatação no padrão brasileiro. Valores nulos viram "—" (sem dado), nunca 0. */

const DASH = '—';
const TIME_ZONE = 'America/Sao_Paulo';

const decimal1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const percent1 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function fmt1(n: number | null | undefined): string {
  return n === null || n === undefined ? DASH : decimal1.format(n);
}

export function fmtInt(n: number | null | undefined): string {
  return n === null || n === undefined ? DASH : integer.format(n);
}

/** 0,452 → "45,2%" */
export function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined ? DASH : percent1.format(n);
}

/** Aproveitamento da classificação: 0,667 → ",667" (convenção do basquete). */
export function fmtWinPct(n: number): string {
  return pct3.format(n).replace(/^0(?=,)/, '');
}

export function fmtSigned(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return DASH;
  const text = digits === 0 ? integer.format(Math.abs(n)) : decimal1.format(Math.abs(n));
  return n > 0 ? `+${text}` : n < 0 ? `−${text}` : text;
}

/** Segundos → "34:12". */
export function fmtMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

/** Data do jogo (AAAA-MM-DD, já no calendário dos EUA): "sáb., 2 de nov." */
export function fmtGameDate(date: string, style: 'long' | 'short' = 'long'): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', style === 'long'
    ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d);
}

/** Horário de início em Brasília: "21:30". */
export function fmtStartTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(new Date(iso));
}

/** Sequência: 3 → "V3", −2 → "D2". */
export function fmtStreak(streak: number): string {
  if (streak === 0) return DASH;
  return streak > 0 ? `V${streak}` : `D${-streak}`;
}

export function fmtGamesBehind(gb: number): string {
  return gb === 0 ? DASH : decimal1.format(gb);
}
