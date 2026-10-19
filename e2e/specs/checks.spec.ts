import { readFileSync } from 'fs';
import { checkSchema, publishSchema } from 'testkit/flow';
import { ProjectType } from 'testkit/seed';
import { expect, test } from '../fixtures';

test.describe('checks', () => {
  test('should not show a diff for a version and check with the same SDL', async ({
    page,
    seed,
    auth,
  }) => {
    const { accessToken, refreshToken, slug, resources } = await seed.seedTarget(
      ProjectType.Federation,
    );
    const sdl = readFileSync('integration-tests/fixtures/federation-00.graphql', 'utf-8');
    await publishSchema(
      {
        sdl,
        service: 'test',
        url: 'http://localhost:4141/test',
        target: {
          byId: resources.targetId,
        },
        author: 'e2e',
        commit: 'xyz',
      },
      accessToken,
    );
    const check = await checkSchema(
      {
        sdl,
        service: 'test',
        url: 'http://localhost:4141/test',
        target: {
          byId: resources.targetId,
        },
      },
      accessToken,
    ).then(r => r.expectNoGraphQLErrors());
    expect(check.schemaCheck.__typename).toBe('SchemaCheckSuccess');

    await auth.useSession({ refreshToken, accessToken });
    await page.goto(
      `/${slug}/checks/${check.schemaCheck.schemaCheck?.id}?filter_changed=false&filter_failed=false`,
      {
        waitUntil: 'domcontentloaded',
      },
    );

    await page.getByTestId('service-view-btn').click(); // move to service tab
    await expect(page.getByTestId('schema-title-before')).toHaveText('test@xyz');
    await expect(page.getByTestId('schema-title')).toHaveText('test@unknown');
    await expect(page.getByTestId('schema-title-changed')).toHaveText('(unchanged)');

    await page.getByTestId('schema-view-btn').click(); // move to schema tab
    await expect(page.getByTestId('schema-title-before')).toHaveText('schema@xyz');
    await expect(page.getByTestId('schema-title')).toHaveText('schema@unknown');
    await expect(page.getByTestId('schema-title-changed')).toHaveText('(unchanged)');
    // The composed public schema, not the service SDL, which opens with `extend schema @link`.
    await expect(page.getByText('# Product Entity').first()).toBeVisible();
    await expect(page.getByText('extend schema')).toHaveCount(0);

    await page.getByTestId('supergraph-view-btn').click(); // move to supergraph tab
    await expect(page.getByTestId('schema-title-before')).toHaveText('supergraph@xyz');
    await expect(page.getByTestId('schema-title')).toHaveText('supergraph@unknown');
    await expect(page.getByTestId('schema-title-changed')).toHaveText('(unchanged)');
  });
});
