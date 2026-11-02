import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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

test.describe('landing page', () => {
  test('mostra a proposta, os recursos e os planos', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Tabelinha/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Estatística de basquete');
    await expect(page.getByRole('heading', { name: 'Recursos' })).toBeVisible();
    await expect(page.getByText('R$ 19,90')).toBeVisible();
    await expect(page.getByText(/sem afiliação com a NBA/)).toBeVisible();
  });

  test('não tem rolagem horizontal', async ({ page }) => {
    await page.goto('/');
    await expectNoHorizontalOverflow(page);
  });

  test('não tem violações de acessibilidade (WCAG 2.1 AA)', async ({ page }) => {
    await page.goto('/');
    await expectNoA11yViolations(page);
  });

  test('primeiro Tab leva ao link "Pular para o conteúdo", visível e funcional', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#conteudo$/);
  });

  test('links da navegação levam às seções', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Planos' }).click();
    await expect(page).toHaveURL(/#planos$/);
    await expect(page.getByRole('heading', { name: 'Planos' })).toBeInViewport();
  });

  test('envia cabeçalhos de segurança', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-powered-by']).toBeUndefined();
  });
});

test.describe('página não encontrada', () => {
  test('retorna 404 com caminho de volta', async ({ page }) => {
    const res = await page.goto('/nao-existe');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflow(page);
  });
});
