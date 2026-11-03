import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));

const { POST } = await import('@/app/api/revalidate/route');

const SECRET = 'segredo-de-teste-com-32-caracteres!';

function post(authorization?: string) {
  return POST(new Request('http://localhost/api/revalidate', { method: 'POST', headers: authorization ? { authorization } : {} }));
}

describe('/api/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    vi.stubEnv('REVALIDATE_SECRET', SECRET);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('com o segredo certo, invalida a tag das estatísticas', async () => {
    const res = await post(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('stats', 'max');
  });

  it('segredo errado, ausente ou sem "Bearer" retorna 401 sem invalidar', async () => {
    for (const auth of [`Bearer ${SECRET}x`, undefined, SECRET, `Bearer ${SECRET.slice(0, -1)}`]) {
      expect((await post(auth)).status).toBe(401);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('sem REVALIDATE_SECRET (ausente ou vazio), a rota fica desligada', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    expect((await post(`Bearer ${SECRET}`)).status).toBe(503);
    expect((await post('Bearer ')).status).toBe(503);
    delete process.env.REVALIDATE_SECRET;
    expect((await post(`Bearer ${SECRET}`)).status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
