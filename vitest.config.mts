import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // O pacote real lança erro fora do Next.js; nos testes ele não tem efeito.
      'server-only': fileURLToPath(new URL('./tests/support/empty-module.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
