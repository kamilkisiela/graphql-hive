import { expect, test } from '../fixtures';

test.describe('Laboratory > Tabs', () => {
  test.beforeEach(async ({ seed, auth, laboratory }) => {
    const { slug, refreshToken, accessToken } = await seed.seedTarget();
    await auth.useSession({ refreshToken, accessToken });
    await laboratory.openSeededTarget(slug);
  });

  test('closing a tab falls back to the previous one, then to the empty state', async ({
    page,
    laboratory,
  }) => {
    await laboratory.addOperationTab();
    await laboratory.setEditorValue('operation', 'query Tab1 { tab1 }');
    await laboratory.addOperationTab();
    await laboratory.setEditorValue('operation', 'query Tab2 { tab2 }');
    await expect(laboratory.activeTab()).toContainText('Tab2');

    await laboratory.closeActiveTab();
    await expect(laboratory.activeTab()).toContainText('Tab1');
    await expect.poll(() => laboratory.getEditorValue('operation')).toContain('tab1');

    await laboratory.closeActiveTab();
    await expect(laboratory.tabs()).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add operation' }).first()).toBeVisible();

    await laboratory.addOperationTab();
    await expect.poll(() => laboratory.getEditorValue('operation')).toBe('');
  });
});
