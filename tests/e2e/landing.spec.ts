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
    await expect(page).toHaveTitle(/STATS ALL IN/);
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

  test('link "Planos" da navegação abre a página de planos', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Planos' }).click();
    await expect(page).toHaveURL(/\/planos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Planos' })).toBeVisible();
  });

  test('envia cabeçalhos de segurança', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-powered-by']).toBeUndefined();
    const csp = res.headers()['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  test('a CSP não bloqueia nada do próprio site (navegação, formulários, tabelas)', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(`${page.url()}: ${m.text()}`);
    });
    for (const path of ['/', '/jogos', '/jogos/1', '/jogadores?ordem=reb', '/times/AUR', '/cadastro', '/planos']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    // Navegação pelo cliente (usa os scripts e o RSC) e uma Server Action
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Classificação' }).click();
    await expect(page).toHaveURL(/\/classificacao$/);
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('teste@exemplo.com');
    await page.getByLabel('Senha').fill('x');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'modo demonstração' })).toBeVisible();
    expect(violations).toEqual([]);
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
