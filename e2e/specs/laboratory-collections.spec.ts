import { expect, test } from '../fixtures';
import type { SeedProject } from '../fixtures';
import type { LaboratoryHelper } from '../helpers/laboratory';

let slug: string;
let project: SeedProject;

const ok = <T>(result: { ok?: T | null }): T => {
  if (!result.ok) {
    throw new Error('seeding failed');
  }
  return result.ok;
};

const openWithOperation = async (laboratory: LaboratoryHelper, query = 'query op1 { test }') => {
  await laboratory.openSeededTarget(slug);
  await laboratory.addOperationTab();
  await laboratory.setEditorValue('operation', query);
};

test.describe('Laboratory > Collections', () => {
  test.beforeEach(async ({ seed, auth }) => {
    const seeded = await seed.seedTarget();
    slug = seeded.slug;
    project = seeded.project;
    await auth.useSession({ refreshToken: seeded.refreshToken, accessToken: seeded.accessToken });
  });

  test('creates a collection, saves an operation into it and keeps it across a reload', async ({
    page,
    laboratory,
  }) => {
    await openWithOperation(laboratory);
    await laboratory.addCollection('collection-1');
    const saved = page.waitForResponse(response =>
      (response.request().postData() ?? '').includes('LaboratoryCreateOperation'),
    );
    await laboratory.saveOperationToCollection('collection-1');
    await saved;
    await laboratory.openCollection('collection-1');
    await expect(laboratory.operationRow('op1')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hive-laboratory-host')).toBeVisible({ timeout: 30_000 });
    await laboratory.openCollectionsPanel();
    await laboratory.openCollection('collection-1');

    await expect(laboratory.operationRow('op1')).toBeVisible();
  });

  test('renames a collection in place', async ({ laboratory }) => {
    await openWithOperation(laboratory);
    await laboratory.addCollection('collection-1');
    await laboratory.saveOperationToCollection('collection-1');

    await laboratory.renameCollection('collection-1', 'collection-1-updated');

    await laboratory.openCollection('collection-1-updated');
    await expect(laboratory.operationRow('op1')).toBeVisible();
  });

  test('deletes a collection with its operations', async ({ page, laboratory }) => {
    await openWithOperation(laboratory);
    await laboratory.addCollection('collection-1');
    await laboratory.saveOperationToCollection('collection-1');
    await laboratory.openCollection('collection-1');
    await expect(laboratory.operationRow('op1')).toBeVisible();

    await laboratory.deleteCollection('collection-1');

    await expect(
      page.locator('.hive-laboratory').getByRole('button', { name: 'collection-1', exact: true }),
    ).toBeHidden();
    await expect(laboratory.operationRow('op1')).toBeHidden();
  });

  test('deletes one operation and keeps its sibling', async ({ laboratory }) => {
    await openWithOperation(laboratory, 'query op1 { test }');
    await laboratory.addCollection('collection-1');
    await laboratory.saveOperationToCollection('collection-1');
    await laboratory.addOperationTab();
    await laboratory.setEditorValue('operation', 'query op2 { test }');
    await laboratory.saveOperationToCollection('collection-1');
    await laboratory.openCollection('collection-1');
    await expect(laboratory.operationRow('op2')).toBeVisible();

    await laboratory.deleteOperation('op1');

    await expect(laboratory.operationRow('op1')).toBeHidden();
    await expect(laboratory.operationRow('op2')).toBeVisible();
  });

  test('opens a linked operation once and activates its tab', async ({ page, laboratory }) => {
    const { collection } = ok(
      await project.createDocumentCollection({ name: 'collection-1', description: '' }),
    );
    const { operation } = ok(
      await project.createOperationInCollection({
        collectionId: collection.id,
        name: 'operation-1',
        query: 'query op1 { test }',
      }),
    );

    await laboratory.openSeededTarget(slug, `?operation=${operation.id}`);
    await expect(laboratory.tabs()).toHaveCount(1);
    await expect(laboratory.activeTab()).toContainText('operation-1');
    await expect.poll(() => laboratory.getEditorValue('operation')).toContain('op1');

    await page.goto(`/${slug}/laboratory?operation=${operation.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('.hive-laboratory-host')).toBeVisible({ timeout: 30_000 });

    await expect(laboratory.tabs()).toHaveCount(1);
    await expect(laboratory.activeTab()).toContainText('operation-1');
  });
});
