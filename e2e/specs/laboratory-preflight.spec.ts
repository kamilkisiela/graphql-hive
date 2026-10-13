import { expect, test } from '../fixtures';
import type { SeedProject } from '../fixtures';
import type { LaboratoryHelper } from '../helpers/laboratory';

const QUERY = 'query PreflightTest { __typename }';
const PROMPT_SCRIPT = `const username = await lab.prompt('Enter your username');
console.info(username);`;
const LEVELS_SCRIPT = `console.log('Hello_world');
console.info(1);
console.warn(true);
console.error('Fatal');
throw new TypeError('Test');`;

let slug: string;
let project: SeedProject;

const openWithOperation = async (laboratory: LaboratoryHelper) => {
  await laboratory.openSeededTarget(slug);
  await laboratory.addOperationTab();
  await laboratory.setEditorValue('operation', QUERY);
};

test.describe('Laboratory > Preflight', () => {
  test.beforeEach(async ({ seed, auth }) => {
    const seeded = await seed.seedTarget();
    slug = seeded.slug;
    project = seeded.project;
    await auth.useSession({ refreshToken: seeded.refreshToken, accessToken: seeded.accessToken });
  });

  test('saves the script to the target and the env to the browser', async ({
    page,
    laboratory,
  }) => {
    await laboratory.openSeededTarget(slug);
    await laboratory.openPreflightTab();
    const saved = page.waitForResponse(response =>
      (response.request().postData() ?? '').includes('LaboratoryUpdatePreflightScript'),
    );
    await laboratory.setEditorValue('preflight', 'console.log("Hello_world")');
    await saved;
    await laboratory.openEnvTab();
    await laboratory.setEditorValue('env', 'foo=123');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hive-laboratory-host')).toBeVisible({ timeout: 30_000 });

    await laboratory.openPreflightTab();
    await expect
      .poll(() => laboratory.getEditorValue('preflight'))
      .toBe('console.log("Hello_world")');
    await laboratory.openEnvTab();
    await expect.poll(() => laboratory.getEditorValue('env')).toContain('foo=123');
  });

  test('logs every console level and a thrown error with its position', async ({ laboratory }) => {
    await project.updatePreflightScript({ sourceCode: LEVELS_SCRIPT });
    await laboratory.openSeededTarget(slug);
    await laboratory.openPreflightTab();

    await laboratory.runPreflightTest();

    const logs = laboratory.logs();
    await expect(logs.locator('[data-level="log"]')).toContainText(['Hello_world']);
    await expect(logs.locator('[data-level="log"]')).toContainText('(1:1)');
    await expect(logs.locator('[data-level="info"]')).toContainText('1');
    await expect(logs.locator('[data-level="warn"]')).toContainText('true');
    await expect(logs.locator('[data-level="error"]')).toContainText(['Fatal', 'Test']);
  });

  test('hands a prompt answer back to the script', async ({ laboratory }) => {
    await project.updatePreflightScript({ sourceCode: PROMPT_SCRIPT });
    await laboratory.openSeededTarget(slug);
    await laboratory.openPreflightTab();

    await laboratory.runPreflightTest();
    await laboratory.answerPrompt('Enter your username', 'test-username');

    await expect(laboratory.logs().locator('[data-level="info"]')).toContainText('test-username');
  });

  test('hands null to the script when the prompt is cancelled', async ({ laboratory }) => {
    await project.updatePreflightScript({ sourceCode: PROMPT_SCRIPT });
    await laboratory.openSeededTarget(slug);
    await laboratory.openPreflightTab();

    await laboratory.runPreflightTest();
    await laboratory.cancelPrompt();

    await expect(laboratory.logs().locator('[data-level="info"]')).toContainText('null');
  });

  test('writes environment variables set by the script into the env editor', async ({
    laboratory,
  }) => {
    await project.updatePreflightScript({
      sourceCode: `lab.environment.set('my-test', 'TROLOLOL');`,
    });
    await laboratory.openSeededTarget(slug);
    await laboratory.openPreflightTab();

    await laboratory.runPreflightTest();
    await laboratory.openEnvTab();

    await expect.poll(() => laboratory.getEditorValue('env')).toContain('my-test=TROLOLOL');
  });

  test('exposes crypto-js as lab.CryptoJS', async ({ laboratory }) => {
    await project.updatePreflightScript({
      sourceCode: `console.log(lab.CryptoJS.SHA256('test').toString());`,
    });
    await laboratory.openSeededTarget(slug);
    await laboratory.openPreflightTab();

    await laboratory.runPreflightTest();

    await expect(laboratory.logs().locator('[data-level="log"]')).toContainText(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    );
  });

  test('clears the preflight logs on request', async ({ laboratory }) => {
    await project.updatePreflightScript({ sourceCode: `console.log('Hello_world');` });
    await laboratory.openSeededTarget(slug);
    await laboratory.openPreflightTab();
    await laboratory.runPreflightTest();
    await expect(laboratory.logs()).toContainText('Hello_world');

    await laboratory.logs().page().getByRole('button', { name: 'Clear' }).click();

    await expect(laboratory.logs()).toBeHidden();
    await expect(laboratory.logs().page().getByText('No logs yet')).toBeVisible();
  });

  test('carries the GraphiQL env and toggle over on first visit', async ({ page, laboratory }) => {
    await project.updatePreflightScript({ sourceCode: `console.log('legacy');` });
    await page.addInitScript(() => {
      window.localStorage.setItem('hive:laboratory:environment', '{"foo":"bar","count":2}');
      window.localStorage.setItem('hive:laboratory:isPreflightScriptEnabled', 'true');
    });
    await openWithOperation(laboratory);

    await expect(page.getByRole('button', { name: 'Disable preflight' })).toBeVisible();
    await laboratory.openEnvTab();
    const env = await laboratory.getEditorValue('env');
    expect(env).toContain('foo=bar');
    expect(env).toContain('count=2');
  });

  test.describe('execution', () => {
    test('sends headers the script appends', async ({ laboratory }) => {
      await project.updatePreflightScript({
        sourceCode: `lab.request.headers.append('foo', 'bar');`,
      });
      await openWithOperation(laboratory);
      await laboratory.enablePreflight();

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();

      expect((await request).headers().foo).toBe('bar');
    });

    test('lets a preflight header win over the operation header', async ({ laboratory }) => {
      await project.updatePreflightScript({
        sourceCode: `lab.request.headers.append('x-test', 'from-preflight');`,
      });
      await openWithOperation(laboratory);
      await laboratory.setEditorValue('headers', '{"x-test":"from-operation"}');
      await laboratory.enablePreflight();

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();

      expect((await request).headers()['x-test']).toBe('from-preflight');
    });

    test('templates operation headers but sends preflight headers verbatim', async ({
      laboratory,
    }) => {
      await project.updatePreflightScript({
        sourceCode: `lab.environment.set('bar', 'BAR_VALUE');
lab.request.headers.append('foo_preflight', '{{bar}}');`,
      });
      await openWithOperation(laboratory);
      await laboratory.setEditorValue('headers', '{"foo_static":"{{bar}}"}');
      await laboratory.enablePreflight();

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();

      const headers = (await request).headers();
      expect(headers.foo_preflight).toBe('{{bar}}');
      expect(headers.foo_static).toBe('BAR_VALUE');
    });

    test('substitutes env editor values into headers and leaves unknown names', async ({
      laboratory,
    }) => {
      await openWithOperation(laboratory);
      await laboratory.openEnvTab();
      await laboratory.setEditorValue('env', 'foo=injected');
      await laboratory.activateTab('PreflightTest');
      await laboratory.setEditorValue('headers', '{"__test":"{{foo}} bar {{nonExist}}"}');

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();

      expect((await request).headers().__test).toBe('injected bar {{nonExist}}');
    });

    test('uses env values the script sets for header substitution', async ({ laboratory }) => {
      await project.updatePreflightScript({ sourceCode: `lab.environment.set('foo', '92');` });
      await openWithOperation(laboratory);
      await laboratory.setEditorValue('headers', '{"__test":"{{foo}}"}');
      await laboratory.enablePreflight();

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();

      expect((await request).headers().__test).toBe('92');
    });

    test('feeds a prompt answer through env into a header', async ({ laboratory }) => {
      await project.updatePreflightScript({
        sourceCode: `const username = await lab.prompt('Enter your username');
lab.environment.set('username', username);`,
      });
      await openWithOperation(laboratory);
      await laboratory.setEditorValue('headers', '{"__test":"{{username}}"}');
      await laboratory.enablePreflight();

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();
      await laboratory.answerPrompt('Enter your username', 'foo');

      expect((await request).headers().__test).toBe('foo');
    });

    test('does not run a disabled script', async ({ laboratory }) => {
      await project.updatePreflightScript({ sourceCode: `lab.environment.set('foo', 92);` });
      await openWithOperation(laboratory);
      await laboratory.openEnvTab();
      await laboratory.setEditorValue('env', 'foo=10');
      await laboratory.activateTab('PreflightTest');
      await laboratory.setEditorValue('headers', '{"__test":"{{foo}}"}');

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();

      expect((await request).headers().__test).toBe('10');
    });

    test('shows the run logs in the response pane', async ({ page, laboratory }) => {
      await project.updatePreflightScript({
        sourceCode: `console.info(1);
console.warn(true);
console.error('Fatal');`,
      });
      await openWithOperation(laboratory);
      await laboratory.enablePreflight();

      const request = laboratory.waitForLabRequest('PreflightTest');
      await laboratory.runOperation();
      await request;

      const tab = page.getByRole('tab', { name: 'Preflight' });
      await tab.click();
      // Request and response panes both have tab panels; follow this tab's own panel.
      const pane = page.locator(`[id="${await tab.getAttribute('aria-controls')}"]`);
      await expect(pane).toContainText('1');
      await expect(pane).toContainText('true');
      await expect(pane).toContainText('Fatal');
    });
  });
});
