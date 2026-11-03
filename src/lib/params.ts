import { z } from 'zod';

/** Validação dos parâmetros de URL das páginas. Valor inválido vira null (a página usa o padrão). */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  });

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDateParam(params: SearchParams, key: string): string | null {
  const r = isoDate.safeParse(first(params[key]));
  return r.success ? r.data : null;
}

export function parseEnumParam<const T extends readonly string[]>(params: SearchParams, key: string, values: T): T[number] | null {
  const v = first(params[key]);
  return v !== undefined && (values as readonly string[]).includes(v) ? (v as T[number]) : null;
}

/** Texto de busca: até 40 caracteres, sem espaços sobrando. */
export function parseSearchParam(params: SearchParams, key: string): string {
  return (first(params[key]) ?? '').trim().slice(0, 40);
}

/** Id numérico de rota (/jogos/123). */
export function parseIdParam(value: string): number | null {
  return /^\d{1,12}$/.test(value) ? Number(value) : null;
}

/** Sigla de time (/times/BOS). */
export function parseTeamParam(value: string): string | null {
  const v = value.toUpperCase();
  return /^[A-Z]{2,4}$/.test(v) ? v : null;
}
