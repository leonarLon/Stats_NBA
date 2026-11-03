import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Páginas de conta em modo demonstração (sem Supabase): renderizam, mas não autenticam. */

async function expectPageQuality(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'conteúdo mais largo que a tela').toBeLessThanOrEqual(innerWidth);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

const PAGES = [
  { path: '/entrar', heading: 'Entrar' },
  { path: '/cadastro', heading: 'Criar conta' },
  { path: '/recuperar-senha', heading: 'Esqueci a senha' },
  { path: '/redefinir-senha', heading: 'Nova senha' },
  { path: '/conta', heading: 'Minha conta' },
  { path: '/planos', heading: 'Planos' },
  { path: '/termos', heading: 'Termos de uso' },
  { path: '/privacidade', heading: 'Política de privacidade' },
];

for (const p of PAGES) {
  test(`${p.path}: carrega sem rolagem lateral e sem violações de acessibilidade`, async ({ page }) => {
    await page.goto(p.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.heading);
    await page.waitForSelector('[aria-busy]', { state: 'detached' }).catch(() => {});
    await expectPageQuality(page);
  });
}

test('cadastro avisa que está desligado no modo demonstração, sem quebrar', async ({ page }) => {
  await page.goto('/cadastro');
  await page.getByLabel('E-mail').fill('teste@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-segura-1');
  await page.getByLabel('Repita a senha').fill('senha-segura-1');
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'modo demonstração' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue('teste@exemplo.com');
  await expectPageQuality(page);
});

test('login avisa que está desligado no modo demonstração', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('teste@exemplo.com');
  await page.getByLabel('Senha').fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'modo demonstração' })).toBeVisible();
});

test('link de e-mail inválido volta ao login com aviso', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=x&type=signup&proximo=https://mal.com');
  await expect(page).toHaveURL(/\/entrar\?erro=link$/);
  await expect(page.getByRole('alert').filter({ hasText: 'O link expirou' })).toBeVisible();
});

test('cadastro tem links para termos e privacidade; rodapé também', async ({ page }) => {
  await page.goto('/cadastro');
  await page.getByRole('main').getByRole('link', { name: 'termos de uso' }).click();
  await expect(page).toHaveURL(/\/termos$/);
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Privacidade' })).toBeVisible();
});
