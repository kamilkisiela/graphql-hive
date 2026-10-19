/**
 * Visual regression for every Foundry preview, in both themes.
 *
 * Foundry renders each `*.preview.tsx` export at `/<nav>/<ExportName>`, so this spec discovers
 * previews by parsing the source the same way Foundry does (see react-foundry's README, "How
 * discovery reads your files") and screenshots each one. No backend is needed: the `visual-foundry`
 * Playwright project starts the Foundry dev server itself.
 *
 * Baselines live in `e2e/__screenshots__` and are keyed by platform. Regenerate with
 * `pnpm test:visual:update` (locally) or the `update-screenshots` workflow (Linux, for CI).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';

const APP_SRC = join(import.meta.dirname, '../../packages/web/app/src');
const THEMES = ['light', 'dark'] as const;

type Preview = { nav: string; name: string; file: string; url: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.preview.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function discoverPreviews(): Preview[] {
  const previews: Preview[] = [];
  for (const file of walk(APP_SRC).sort()) {
    const source = readFileSync(file, 'utf8');
    const navMatch = source.match(/^export const nav: NavPath = '([^']+)'/m);
    const nav = navMatch?.[1] ?? relative(APP_SRC, file).replace(/\.preview\.tsx$/, '');
    for (const match of source.matchAll(/^export const (\w+) = createPreview\(/gm)) {
      const name = match[1];
      previews.push({
        nav,
        name,
        file: relative(APP_SRC, file),
        url: '/' + [...nav.split('/'), name].map(encodeURIComponent).join('/'),
      });
    }
  }
  return previews;
}

const previews = discoverPreviews();

test.describe('foundry previews', () => {
  test('discovers previews', () => {
    expect(previews.length).toBeGreaterThan(0);
  });

  for (const preview of previews) {
    test.describe(preview.nav, () => {
      for (const theme of THEMES) {
        test(`${preview.name} [${theme}]`, async ({ page }, testInfo) => {
          testInfo.annotations.push({ type: 'preview', description: preview.file });

          await page.addInitScript(
            ({ theme }) => {
              localStorage.setItem('react-foundry-theme', theme);
              // Collapse Foundry's shelf and props panel so the canvas gets the full viewport and
              // the only chrome in the frame is the small toolbar.
              localStorage.setItem(
                'react-foundry-ui',
                JSON.stringify({
                  state: { isShelfOpen: false, isPanelOpen: false, expandedNodes: [] },
                  version: 0,
                }),
              );
            },
            { theme },
          );

          await page.goto(preview.url, { waitUntil: 'networkidle' });

          const canvas = page.locator('[data-foundry-canvas]');
          await expect(canvas).toHaveAttribute('data-empty', 'false');
          await expect(page.locator('html')).toHaveClass(
            theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
          );
          await page.evaluate(() => document.fonts.ready);

          // Viewport only: Foundry sizes its canvas to the viewport, so a full-page capture
          // re-measures a 100vh layout on every attempt and never settles.
          await expect(page).toHaveScreenshot(`${preview.nav}/${preview.name}-${theme}.png`);
        });
      }
    });
  }
});
