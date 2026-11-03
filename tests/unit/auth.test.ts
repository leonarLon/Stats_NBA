import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeNextPath, signUpSchema, fieldErrors } from '@/server/auth/validation';

// --- Simulações do Supabase e do Next ---------------------------------------

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getClaims: vi.fn(),
};
const adminRpc = vi.fn();
const adminDeleteUser = vi.fn();
const profileUpdate = vi.fn();

vi.mock('@/server/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock('@/server/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    rpc: adminRpc,
    auth: { admin: { deleteUser: adminDeleteUser } },
    from: () => ({ update: (v: unknown) => ({ eq: () => ({ is: async () => (profileUpdate(v), { error: null }) }) }) }),
  }),
}));
vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }) }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const actions = await import('@/server/auth/actions');

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const IDLE = { status: 'idle' as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemplo.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_teste_com_mais_de_20');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://tabelinha.example');
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1', email: 'a@b.com' } }, error: null });
});

// --- Validação ----------------------------------------------------------------

describe('destino depois do login', () => {
  it('aceita caminhos internos', () => {
    expect(safeNextPath('/jogadores?ordem=reb')).toBe('/jogadores?ordem=reb');
    expect(safeNextPath('/times/BOS')).toBe('/times/BOS');
  });

  it('recusa endereços externos e truques de URL', () => {
    for (const bad of ['https://mal.com', '//mal.com', '/\\mal.com', 'javascript:alert(1)', '/\tmal', '', undefined, ['/'], 'jogos']) {
      expect(safeNextPath(bad), String(bad)).toBe('/jogos');
    }
  });
});

describe('cadastro', () => {
  const ok = { email: ' Fulano@Exemplo.com ', password: 'senha-segura-1', confirmPassword: 'senha-segura-1', terms: 'on' };

  it('normaliza o e-mail', () => {
    expect(signUpSchema.parse(ok).email).toBe('fulano@exemplo.com');
  });

  it('exige senha de 8+, confirmação igual e aceite dos termos', () => {
    const r = signUpSchema.safeParse({ ...ok, password: 'curta', confirmPassword: 'outra', terms: undefined });
    expect(r.success).toBe(false);
    const errors = fieldErrors(r.error!);
    expect(errors.password).toMatch(/8 caracteres/);
    expect(errors.terms).toMatch(/termos/);
  });
});

// --- Ações --------------------------------------------------------------------

describe('ações de conta', () => {
  it('login com sucesso vai para o destino seguro', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(actions.signIn(IDLE, form({ email: 'a@b.com', password: 'x', proximo: 'https://mal.com' }))).rejects.toThrow('REDIRECT:/jogos');
    await expect(actions.signIn(IDLE, form({ email: 'a@b.com', password: 'x', proximo: '/times/BOS' }))).rejects.toThrow('REDIRECT:/times/BOS');
  });

  it('login com senha errada: mensagem em português e e-mail preservado', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } });
    const state = await actions.signIn(IDLE, form({ email: 'a@b.com', password: 'errada' }));
    expect(state).toMatchObject({ status: 'error', message: 'E-mail ou senha incorretos.', email: 'a@b.com' });
  });

  it('erro desconhecido do Auth vira mensagem genérica', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'algo_novo', status: 500 } });
    const state = await actions.signIn(IDLE, form({ email: 'a@b.com', password: 'x' }));
    expect(state.message).toMatch(/Não foi possível concluir/);
  });

  it('cadastro: mesma resposta para e-mail novo ou já cadastrado, com link de volta ao site', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null });
    const state = await actions.signUp(IDLE, form({ email: 'novo@b.com', password: 'senha-segura-1', confirmPassword: 'senha-segura-1', terms: 'on' }));
    expect(state.status).toBe('success');
    expect(state.message).toMatch(/Se o e-mail novo@b.com ainda não tiver conta/);
    expect(auth.signUp.mock.calls[0][0].options.emailRedirectTo).toBe('https://tabelinha.example/auth/confirm?proximo=/planos');
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ terms_accepted_at: expect.any(String) }));
  });

  it('cadastro inválido não chama o Supabase', async () => {
    const state = await actions.signUp(IDLE, form({ email: 'x', password: '1', confirmPassword: '1' }));
    expect(state.status).toBe('error');
    expect(state.fields?.email).toBeDefined();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('recuperação de senha não revela se o e-mail existe', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'user_not_found', status: 400 } });
    const state = await actions.requestPasswordReset(IDLE, form({ email: 'quem@b.com' }));
    expect(state.status).toBe('success');
  });

  it('recuperação de senha mostra o limite de envios', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', status: 429 } });
    const state = await actions.requestPasswordReset(IDLE, form({ email: 'quem@b.com' }));
    expect(state).toMatchObject({ status: 'error', message: expect.stringMatching(/Aguarde/) });
  });

  it('teste grátis: inicia para o usuário da sessão, nunca de outro', async () => {
    adminRpc.mockResolvedValue({ error: null });
    await expect(actions.startTrial()).rejects.toThrow('REDIRECT:/jogos');
    expect(adminRpc).toHaveBeenCalledWith('start_trial', { p_user_id: 'user-1' });
  });

  it('teste grátis já usado', async () => {
    adminRpc.mockResolvedValue({ error: { message: 'trial_already_used', code: 'P0001' } });
    expect(await actions.startTrial()).toMatchObject({ status: 'error', message: 'O teste grátis já foi usado nesta conta.' });
  });

  it('teste grátis sem sessão manda para o login', async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: { message: 'no session' } });
    await expect(actions.startTrial()).rejects.toThrow('REDIRECT:/entrar');
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('excluir conta exige digitar EXCLUIR e apaga só o usuário da sessão', async () => {
    expect((await actions.deleteAccount(IDLE, form({ confirmation: 'excluir' }))).fields?.confirmation).toBeDefined();
    expect(adminDeleteUser).not.toHaveBeenCalled();

    adminDeleteUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    await expect(actions.deleteAccount(IDLE, form({ confirmation: 'EXCLUIR' }))).rejects.toThrow('REDIRECT:/?conta=excluida');
    expect(adminDeleteUser).toHaveBeenCalledWith('user-1');
  });

  it('bloqueia muitas tentativas de login no mesmo e-mail, sem chamar o Supabase', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } });
    for (let i = 0; i < 8; i++) await actions.signIn(IDLE, form({ email: 'alvo@b.com', password: `tentativa-${i}` }));
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(8);
    const state = await actions.signIn(IDLE, form({ email: 'alvo@b.com', password: 'mais-uma' }));
    expect(state.message).toMatch(/Muitas tentativas seguidas. Tente de novo em \d+ minutos?/);
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(8);
    // Outro e-mail do mesmo IP continua liberado
    await actions.signIn(IDLE, form({ email: 'outro@b.com', password: 'x' }));
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(9);
  });

  it('sem Supabase configurado, as ações avisam que é demonstração', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const state = await actions.signIn(IDLE, form({ email: 'a@b.com', password: 'x' }));
    expect(state.message).toMatch(/modo demonstração/);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
