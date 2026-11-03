import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Páginas de estatística em modo demonstração (dados fictícios de providers/fixture).
 * Jogo fictício: BRV 94 @ AUR 105, em 28/10/2026; próximo jogo BRV × CDR em 03/11.
 */

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'conteúdo mais largo que a tela').toBeLessThanOrEqual(innerWidth);
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

const PAGES = [
  { path: '/classificacao', heading: 'Classificação', ready: 'Conferência Leste' },
  { path: '/jogos', heading: 'Jogos', ready: 'Box score: Brava Marés 94 @ Aurora Cometas 105' },
  { path: '/jogos/1', heading: 'Brava Marés @ Aurora Cometas', ready: 'Box score de Aurora Cometas' },
  { path: '/jogadores', heading: 'Jogadores', ready: 'Jogadores ordenados por pontos por jogo' },
  { path: '/jogadores/1', heading: 'Ícaro Lima', ready: 'Jogos de Ícaro Lima na temporada' },
  { path: '/times', heading: 'Times', ready: 'Estatísticas dos times na temporada 2026-27' },
  { path: '/times/AUR', heading: 'Aurora Cometas', ready: 'Elenco de Aurora Cometas: médias por jogo' },
];

for (const p of PAGES) {
  test.describe(p.path, () => {
    test('carrega, avisa que é demonstração, sem rolagem lateral e sem violações de acessibilidade', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.heading);
      await expect(page.locator(`[aria-label="${p.ready}"], h2:text-is("${p.ready}")`).first()).toBeVisible();
      await expect(page.getByRole('note').filter({ hasText: 'Modo demonstração' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoA11yViolations(page);
    });
  });
}

test('classificação: vencedor em primeiro no Leste', async ({ page }) => {
  await page.goto('/classificacao');
  const east = page.getByRole('region', { name: 'Classificação da Conferência Leste' });
  const rows = east.locator('tbody tr');
  await expect(rows.nth(0)).toContainText('AUR');
  await expect(rows.nth(0)).toContainText('1,000');
  await expect(rows.nth(1)).toContainText('BRV');
});

test('jogos: navega entre datas e abre o box score', async ({ page }) => {
  await page.goto('/jogos');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('28 de out');
  await page.getByRole('link', { name: /Próximo dia/ }).click();
  await expect(page).toHaveURL(/data=2026-11-03/);
  await expect(page.getByText('BRV').first()).toBeVisible();
  await page.getByRole('link', { name: /Dia anterior/ }).click();
  await page.getByRole('link', { name: /^Box score:/ }).click();
  await expect(page).toHaveURL(/\/jogos\/1$/);

  const home = page.getByRole('region', { name: 'Box score de Aurora Cometas' });
  await expect(home.locator('tbody tr')).toHaveCount(5);
  await expect(home.locator('tfoot tr').first()).toContainText('105');
});

test('jogos: data inválida na URL cai na data padrão', async ({ page }) => {
  await page.goto('/jogos?data=2026-02-30');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('28 de out');
});

test('jogadores: ordena por coluna e busca sem acento', async ({ page }) => {
  await page.goto('/jogadores');
  const table = page.getByRole('region', { name: /Jogadores ordenados/ });
  await expect(table.locator('tbody tr')).toHaveCount(10);

  await table.getByRole('link', { name: 'REB' }).click();
  await expect(page).toHaveURL(/ordem=reb/);
  await expect(page.getByRole('columnheader', { name: 'REB' })).toHaveAttribute('aria-sort', 'descending');
  // Igor Assis: 14 rebotes, o maior do jogo fictício
  await expect(page.getByRole('region', { name: /rebotes por jogo/ }).locator('tbody tr').first()).toContainText('Igor Assis');

  await page.getByLabel('Buscar jogador').fill('icaro');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('status')).toContainText('1 jogador encontrado');
  await page.getByRole('link', { name: 'Ícaro Lima' }).click();
  await expect(page).toHaveURL(/\/jogadores\/1$/);
  await expect(page.getByRole('region', { name: /Jogos de Ícaro Lima/ }).locator('tbody tr')).toHaveCount(1);
});

test('times: página do time lista elenco e jogos', async ({ page }) => {
  await page.goto('/times');
  // No celular a tabela mostra só a sigla
  await page.getByRole('region', { name: /Estatísticas dos times/ }).getByRole('link', { name: /^(Aurora Cometas|AUR)$/ }).first().click();
  await expect(page).toHaveURL(/\/times\/AUR$/);
  await expect(page.getByRole('region', { name: /Elenco de Aurora Cometas/ }).locator('tbody tr')).toHaveCount(5);
  await expect(page.getByRole('link', { name: /^Vitória por 105-94 ?: ver box score$/ })).toBeVisible();
});

test('ids e siglas inválidos mostram a página não encontrada', async ({ page }) => {
  for (const path of ['/jogos/999', '/jogos/abc', '/jogadores/999', '/times/ZZZ', '/times/../etc']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'Voltar ao início' }), path).toBeVisible();
  }
});

test('/api/revalidate fica desligada sem segredo e não aceita GET', async ({ request }) => {
  expect((await request.post('/api/revalidate', { headers: { authorization: 'Bearer x' } })).status()).toBe(503);
  expect((await request.get('/api/revalidate')).status()).toBe(405);
});
