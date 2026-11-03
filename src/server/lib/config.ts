import { z } from 'zod';
import { AppError } from './errors';

/**
 * Única leitura de process.env do servidor. Cada grupo é validado só quando usado,
 * para que o build e os testes não exijam credenciais que ainda não existem.
 */

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const supabasePublicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const supabaseAdminSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
});

const providersSchema = z.object({
  APISPORTS_KEY: z.string().min(10),
  APISPORTS_BASE_URL: z.url().default('https://v2.nba.api-sports.io'),
  APISPORTS_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(90),
  APISPORTS_PER_MINUTE: z.coerce.number().int().min(1).max(10).default(9),
  BALLDONTLIE_KEY: z.string().min(10).optional(),
  BALLDONTLIE_BASE_URL: z.url().default('https://api.balldontlie.io/v1'),
  BALLDONTLIE_PER_MINUTE: z.coerce.number().int().min(1).max(5).default(4),
  DATA_PROVIDER_MODE: z.enum(['live', 'fixture']).default('fixture'),
});

const billingSchema = z.object({
  BILLING_ENABLED: bool,
  MP_ACCESS_TOKEN: z.string().min(10).optional(),
  MP_WEBHOOK_SECRET: z.string().min(10).optional(),
});

const appSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  REVALIDATE_SECRET: z.string().min(16).optional(),
  TRIAL_DAYS: z.coerce.number().int().min(1).max(30).default(3),
});

export type SupabasePublicConfig = z.infer<typeof supabasePublicSchema>;
export type SupabaseAdminConfig = z.infer<typeof supabaseAdminSchema>;
export type ProvidersConfig = z.infer<typeof providersSchema>;
export type BillingConfig = z.infer<typeof billingSchema>;
export type AppConfig = z.infer<typeof appSchema>;

/** Subconjunto de process.env aceito pelas funções (facilita testes). */
export type Env = Record<string, string | undefined>;

function parse<T>(name: string, schema: z.ZodType<T>, env: Env): T {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Lista só os nomes das variáveis com problema, nunca os valores
    const vars = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new AppError('CONFIG', `Invalid or missing ${name} environment variables: ${vars.join(', ')}`);
  }
  return result.data;
}

export const getSupabasePublicConfig = (env: Env = process.env) => parse('Supabase', supabasePublicSchema, env);
export const getSupabaseAdminConfig = (env: Env = process.env) => parse('Supabase admin', supabaseAdminSchema, env);
export const getProvidersConfig = (env: Env = process.env) => parse('data provider', providersSchema, env);
export const getBillingConfig = (env: Env = process.env) => {
  const config = parse('billing', billingSchema, env);
  if (config.BILLING_ENABLED && (!config.MP_ACCESS_TOKEN || !config.MP_WEBHOOK_SECRET)) {
    throw new AppError('CONFIG', 'BILLING_ENABLED=true requires MP_ACCESS_TOKEN and MP_WEBHOOK_SECRET');
  }
  return config;
};
export const getAppConfig = (env: Env = process.env) => parse('app', appSchema, env);

/** Indica se as credenciais do Supabase já foram configuradas (o projeto ainda não existe). */
export function isSupabaseConfigured(env: Env = process.env): boolean {
  return supabasePublicSchema.safeParse(env).success;
}
