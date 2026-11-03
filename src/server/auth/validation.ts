import { z } from 'zod';

/** Validação dos formulários de conta. Mensagens em português, exibidas ao lado do campo. */

/** Espaços e maiúsculas são removidos antes de validar (o teclado do celular costuma deixar espaço no fim). */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Informe um e-mail válido.').max(254, 'E-mail longo demais.'));

/** Mínimo de 8 caracteres; o máximo de 72 é o limite do bcrypt usado pelo Supabase Auth. */
const password = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72, 'A senha pode ter no máximo 72 caracteres.');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.').max(72),
});

export const signUpSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    terms: z.literal('on', { error: 'É preciso aceitar os termos de uso e a política de privacidade.' }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' });

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' });

export const deleteAccountSchema = z.object({
  confirmation: z.literal('EXCLUIR', { error: 'Digite EXCLUIR, em maiúsculas, para confirmar.' }),
});

export type FieldErrors = Partial<Record<string, string>>;

/** Primeiro erro de cada campo. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Destino depois do login. Só aceita caminhos internos (começam com uma barra e não com duas),
 * para que um link malicioso não use o login para mandar a pessoa a outro site.
 */
export function safeNextPath(value: unknown, fallback = '/jogos'): string {
  if (typeof value !== 'string' || value.length > 200) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'http://interno.invalid');
    if (url.origin !== 'http://interno.invalid') return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
