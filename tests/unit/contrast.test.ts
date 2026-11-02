import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Lê os tokens de cor de globals.css e verifica contraste WCAG AA (≥ 4,5:1 para texto). */
const css = readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const block = css.slice(start).split('}')[0];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: Array<[fg: string, bg: string]> = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['primary', 'bg'], ['primary', 'surface'],
  ['on-primary', 'primary'],
  ['secondary', 'bg'], ['secondary', 'surface'],
  ['positive', 'bg'], ['positive', 'surface'],
  ['negative', 'bg'], ['negative', 'surface'],
];

describe.each([
  ['escuro', ':root'],
  ['claro', '[data-theme="light"]'],
])('tema %s', (_name, selector) => {
  const t = tokens(selector);
  it.each(PAIRS)('%s sobre %s ≥ 4,5:1', (fg, bg) => {
    expect(t[fg], `token --${fg}`).toBeDefined();
    expect(t[bg], `token --${bg}`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
