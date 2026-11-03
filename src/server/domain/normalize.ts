/** Nome para busca: minúsculo, sem acentos, espaços simples. "Luka Dončić" → "luka doncic". */
export function toSearchName(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Minutos jogados → segundos. Aceita "21", "21:34", "21.5", número ou vazio.
 * Valores inválidos viram 0 (o jogador aparece como sem minutos).
 */
export function parseMinutes(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 60) : 0;
  const text = value.trim();
  if (!text) return 0;
  const clock = /^(\d{1,2}):(\d{1,2})$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const num = Number(text);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 60) : 0;
}

/** Inteiro de texto ou número; null se ausente ou inválido ("+5" → 5, "-3" → -3). */
export function parseIntOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isInteger(n) ? n : null;
}

/** Contador de estatística: ausente → 0. */
export function count(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Data UTC (AAAA-MM-DD) de um instante. */
export function utcDate(iso: string | Date): string {
  return (typeof iso === 'string' ? new Date(iso) : iso).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
