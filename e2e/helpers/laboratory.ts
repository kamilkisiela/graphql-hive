import { expect, type Locator, type Page, type Request } from '@playwright/test';

/** Editors are found through `window.monaco` by model URI or language; no DOM hooks needed. */
export type LaboratoryEditor =
  | 'operation'
  | 'variables'
  | 'headers'
  | 'extensions'
  | 'preflight'
  | 'env';

export type LaboratoryHelper = {
  openSeededTarget(slug: string, search?: string): Promise<void>;
  setEditorValue(editor: LaboratoryEditor, value: string): Promise<void>;
  getEditorValue(editor: LaboratoryEditor): Promise<string>;
  tabs(): Locator;
  activeTab(): Locator;
  addOperationTab(): Promise<void>;
  activateTab(name: string): Promise<void>;
  closeActiveTab(): Promise<void>;
  openCollectionsPanel(): Promise<void>;
  addCollection(name: string): Promise<void>;
  saveOperationToCollection(name: string): Promise<void>;
  collectionRow(name: string): Locator;
  operationRow(name: string): Locator;
  openCollection(name: string): Promise<void>;
  renameCollection(from: string, to: string): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  deleteOperation(name: string): Promise<void>;
  openPreflightTab(): Promise<void>;
  openEnvTab(): Promise<void>;
  enablePreflight(): Promise<void>;
  runPreflightTest(): Promise<void>;
  logs(): Locator;
  answerPrompt(label: string, value: string): Promise<void>;
  cancelPrompt(): Promise<void>;
  runOperation(): Promise<void>;
  /** Register before clicking Run; the mock endpoint also receives introspection POSTs. */
  waitForLabRequest(
    operationName: string,
    predicate?: (request: Request) => boolean,
  ): Promise<Request>;
};

type MonacoLike = {
  editor: {
    getEditors(): Array<{
      getModel(): { uri: { path: string }; getLanguageId(): string } | null;
      getContainerDomNode(): { isConnected: boolean };
      getValue(): string;
      setValue(value: string): void;
    }>;
  };
};

// Runs in the page, so it must be self-contained. Sets the value when one is given and returns
// the editor's current value, or null when the editor is not mounted.
const editorValue = ([editor, value]: readonly [LaboratoryEditor, string | undefined]) => {
  const monaco = (window as unknown as { monaco?: MonacoLike }).monaco;
  const byPath: Partial<Record<LaboratoryEditor, string>> = {
    variables: '/variables.json',
    headers: '/headers.json',
    extensions: '/extensions.json',
  };
  const byLanguage: Partial<Record<LaboratoryEditor, string>> = {
    preflight: 'typescript',
    env: 'dotenv',
  };

  const target = monaco?.editor.getEditors().find(candidate => {
    const model = candidate.getModel();
    if (!model || !candidate.getContainerDomNode().isConnected) {
      return false;
    }
    if (editor === 'operation') {
      return model.uri.path.startsWith('/operation_');
    }
    if (byPath[editor]) {
      return model.uri.path === byPath[editor];
    }
    return model.getLanguageId() === byLanguage[editor];
  });

  if (!target) {
    return null;
  }
  if (value !== undefined) {
    target.setValue(value);
  }
  return target.getValue();
};

export function createLaboratoryHelper(page: Page): LaboratoryHelper {
  const lab = () => page.locator('.hive-laboratory');
  const requestTabs = () =>
    page.getByRole('tablist').filter({ has: page.getByRole('tab', { name: 'Variables' }) });

  const openSettingsMenuItem = async (name: string) => {
    await lab().getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('menuitem', { name }).click();
  };

  const helper: LaboratoryHelper = {
    async openSeededTarget(slug, search = '') {
      await page.addInitScript(() => {
        window.localStorage.setItem('hive:laboratory:welcome-dialog-shown', 'true');
      });
      await page.goto(`/${slug}/laboratory${search}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.hive-laboratory-host')).toBeVisible({ timeout: 30_000 });
    },

    async setEditorValue(editor, value) {
      if (editor === 'headers' || editor === 'extensions' || editor === 'variables') {
        const name = editor[0].toUpperCase() + editor.slice(1);
        await requestTabs().getByRole('tab', { name }).click();
      }

      await expect
        .poll(() => page.evaluate(editorValue, [editor, value] as const), { timeout: 15_000 })
        .toBe(value);
    },

    async getEditorValue(editor) {
      return (await page.evaluate(editorValue, [editor, undefined] as const)) ?? '';
    },

    // The context-menu trigger wraps each tab asChild and overwrites its data-slot.
    tabs() {
      return lab().locator('[aria-roledescription="sortable"]');
    },

    activeTab() {
      return lab().locator('[aria-roledescription="sortable"] [data-state="active"]');
    },

    async addOperationTab() {
      const count = await helper.tabs().count();
      await lab().getByRole('button', { name: 'Add operation' }).first().click();
      await expect(helper.tabs()).toHaveCount(count + 1);
    },

    async activateTab(name) {
      await helper.tabs().filter({ hasText: name }).first().click();
      await expect(helper.activeTab()).toContainText(name);
    },

    async closeActiveTab() {
      const count = await helper.tabs().count();
      await helper.activeTab().getByRole('button', { name: 'Close tab' }).click();
      await expect(helper.tabs()).toHaveCount(count - 1);
    },

    async openCollectionsPanel() {
      const addButton = lab().getByRole('button', { name: 'Add collection' }).first();
      if (!(await addButton.isVisible())) {
        await lab().getByRole('button', { name: 'Collections' }).click();
      }
      await expect(addButton).toBeVisible();
    },

    async addCollection(name) {
      await helper.openCollectionsPanel();
      await lab().getByRole('button', { name: 'Add collection' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Add collection' });
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByRole('button', { name: 'Add collection' }).click();
      await expect(dialog).toBeHidden();
    },

    async saveOperationToCollection(name) {
      await lab().getByRole('button', { name: 'Save operation' }).click();
      const dialog = page.getByRole('dialog', { name: 'Save operation to collection' });
      const picker = dialog.getByRole('combobox');
      if (await picker.count()) {
        await picker.click();
        await page.getByRole('option', { name }).click();
      } else {
        await dialog.getByLabel('New collection name').fill(name);
      }
      await dialog.getByRole('button', { name: 'Save to collection' }).click();
      await expect(dialog).toBeHidden();
    },

    // Both row kinds are `div.group` wrapping a button named after the item plus its actions.
    collectionRow(name) {
      return lab()
        .locator('div.group', { has: page.getByRole('button', { name, exact: true }) })
        .first();
    },

    operationRow(name) {
      return helper.collectionRow(name);
    },

    async openCollection(name) {
      const trigger = helper.collectionRow(name).getByRole('button', { name, exact: true });
      if ((await trigger.getAttribute('data-state')) !== 'open') {
        await trigger.click();
      }
      await expect(trigger).toHaveAttribute('data-state', 'open');
    },

    async renameCollection(from, to) {
      const row = helper.collectionRow(from);
      await row.hover();
      await row.getByRole('button', { name: 'Edit collection' }).click();
      // Editing swaps the name button for an input, so the row no longer matches by name.
      const input = lab().locator('div.group').getByRole('textbox');
      await input.fill(to);
      await input.press('Enter');
      await expect(lab().getByRole('button', { name: to, exact: true })).toBeVisible();
    },

    async deleteCollection(name) {
      const row = helper.collectionRow(name);
      await row.hover();
      await row.getByRole('button', { name: 'Delete collection' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).toBeHidden();
    },

    async deleteOperation(name) {
      const row = helper.operationRow(name);
      await row.hover();
      await row.getByRole('button', { name: 'Delete operation' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).toBeHidden();
    },

    async openPreflightTab() {
      await openSettingsMenuItem('Preflight Script');
      await expect(lab().getByRole('button', { name: /^(Test|Stop)$/ })).toBeVisible();
    },

    async openEnvTab() {
      await openSettingsMenuItem('Environment Variables');
    },

    async enablePreflight() {
      const toggle = lab().getByRole('button', { name: 'Enable preflight' });
      if (await toggle.count()) {
        await toggle.click();
      }
      await expect(lab().getByRole('button', { name: 'Disable preflight' })).toBeVisible();
    },

    async runPreflightTest() {
      await lab().getByRole('button', { name: 'Test', exact: true }).click();
    },

    logs() {
      return lab().getByRole('log', { name: 'Preflight logs' });
    },

    async answerPrompt(label, value) {
      const dialog = page.getByRole('dialog', { name: 'Preflight script request' });
      await dialog.getByLabel(label).fill(value);
      await dialog.getByRole('button', { name: 'Submit' }).click();
      await expect(dialog).toBeHidden();
    },

    async cancelPrompt() {
      const dialog = page.getByRole('dialog', { name: 'Preflight script request' });
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    },

    async runOperation() {
      await lab().getByRole('button', { name: 'Run', exact: true }).click();
    },

    waitForLabRequest(operationName, predicate = () => true) {
      return page.waitForRequest(
        request =>
          request.method() === 'POST' &&
          request.url().includes('/api/lab/') &&
          (request.postData() ?? '').includes(operationName) &&
          predicate(request),
      );
    },
  };

  return helper;
}
