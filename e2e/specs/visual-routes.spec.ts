/**
 * Visual regression for the app's routes, in both themes, against the e2e stack.
 *
 * One organization / project / target is seeded through the testkit with fixed slugs, two schema
 * versions, a schema check, usage, an alert and a document collection, so every page has something
 * to render. Each route is then screenshotted in light and dark.
 *
 * Nondeterministic regions (relative times, dates, charts, editors, the owner's e-mail) are masked
 * rather than waited on. Baselines live in `e2e/__screenshots__` and are keyed by platform; the
 * Linux ones CI compares against come from the `update-screenshots` workflow.
 */
import { readFileSync } from 'node:fs';
import {
  updateMe,
  updateOrganizationSlug,
  updateProjectSlug,
  updateTargetSlug,
} from 'testkit/flow';
import { AlertChannelType, AlertType } from 'testkit/gql/graphql';
import { initSeed, ProjectType } from 'testkit/seed';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';

const THEMES = ['light', 'dark'] as const;

/** Fixed slugs so headers, breadcrumbs and pickers render identically on every run. */
const SLUGS = { organization: 'visual-org', project: 'visual-project', target: 'visual-target' };

/** "Oct 19, 2026" and friends, as `DateWithTimeAgo` and the tables format them. */
const DATE_PATTERN = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/;

type Seeded = {
  slugs: typeof SLUGS;
  accessToken: string;
  refreshToken: string;
  email: string;
  schemaCheckId: string;
  schemaVersionId: string;
};

function fixture(name: string) {
  return readFileSync(`integration-tests/fixtures/${name}.graphql`, 'utf8');
}

async function seedVisualTarget(): Promise<Seeded> {
  const seed = initSeed();
  const owner = await seed.createOwner();
  const org = await owner.createOrg();
  const project = await org.createProject(ProjectType.Federation);
  const token = await project.createTargetAccessToken({});
  const organizationSlug = org.organization.slug;

  await updateMe({ displayName: 'Visual Tester', fullName: 'Visual Tester' }, owner.ownerToken);

  // A fresh stack (CI) always accepts the fixed slugs. A local stack that already holds them from an
  // earlier run cannot be renamed into, so fall back to the random slugs and say so: screenshots
  // containing the slug will then differ from the baselines.
  const slugs = { ...SLUGS };
  const renamedOrg = await updateOrganizationSlug(
    { organizationSlug, slug: SLUGS.organization },
    owner.ownerToken,
  ).then(r => r.expectNoGraphQLErrors());
  if (renamedOrg.updateOrganizationSlug.ok) {
    const renamedProject = await updateProjectSlug(
      { project: { byId: project.project.id }, slug: SLUGS.project },
      owner.ownerToken,
    ).then(r => r.expectNoGraphQLErrors());
    const renamedTarget = await updateTargetSlug(
      { target: { byId: project.target.id }, slug: SLUGS.target },
      owner.ownerToken,
    ).then(r => r.expectNoGraphQLErrors());
    if (!renamedProject.updateProjectSlug.ok || !renamedTarget.updateTargetSlug.ok) {
      throw new Error('Renamed the organization but not the project or target; stack is dirty.');
    }
  } else {
    slugs.organization = organizationSlug;
    slugs.project = project.project.slug;
    slugs.target = project.target.slug;
    test.info().annotations.push({
      type: 'warning',
      description: `Fixed slugs are taken on this stack (${renamedOrg.updateOrganizationSlug.error?.message}); using ${slugs.organization}/${slugs.project}/${slugs.target}. Reset the stack to compare against baselines.`,
    });
  }

  // Two subgraphs give the history page a diff and the explorer a composed schema.
  await token
    .publishSchema({
      sdl: fixture('federation-00'),
      service: 'products',
      url: 'http://localhost:4000/products',
      author: 'Visual Tester',
      commit: 'products-v1',
    })
    .then(r => r.expectNoGraphQLErrors());
  await token
    .publishSchema({
      sdl: fixture('federation-01'),
      service: 'notifications',
      url: 'http://localhost:4000/notifications',
      author: 'Visual Tester',
      commit: 'notifications-v1',
    })
    .then(r => r.expectNoGraphQLErrors());

  const check = await token
    .checkSchema(fixture('federation-00'), 'products', {
      author: 'Visual Tester',
      commit: 'products-v1',
    })
    .then(r => r.expectNoGraphQLErrors());
  const schemaCheckId = check.schemaCheck.schemaCheck?.id;
  if (!schemaCheckId) {
    throw new Error(`Schema check did not return an id: ${JSON.stringify(check.schemaCheck)}`);
  }

  await token.collectUsage({
    size: 2,
    map: {
      op1: {
        operation: 'query allProducts { allProducts { id } }',
        operationName: 'allProducts',
        fields: ['Query', 'Query.allProducts', 'ProductItf', 'ProductItf.id'],
      },
      op2: {
        operation: 'query notifications { notifications { id } }',
        operationName: 'notifications',
        fields: ['Query', 'Query.notifications', 'Notification', 'Notification.id'],
      },
    },
    operations: [
      {
        operationMapKey: 'op1',
        timestamp: Date.now(),
        execution: { ok: true, duration: 120_000_000, errorsTotal: 0 },
        metadata: { client: { name: 'visual-client', version: '1.0.0' } },
      },
      {
        operationMapKey: 'op2',
        timestamp: Date.now(),
        execution: { ok: false, duration: 340_000_000, errorsTotal: 1 },
        metadata: { client: { name: 'visual-client', version: '1.0.0' } },
      },
    ],
  });
  await project.waitForOperationsCollected(2);

  const channel = await project.addAlertChannel({
    organizationSlug: slugs.organization,
    projectSlug: slugs.project,
    name: 'visual-webhook',
    type: AlertChannelType.Webhook,
    webhook: { endpoint: 'https://example.com/hive-alerts' },
  });
  const channelId = channel.ok?.addedAlertChannel.id;
  if (!channelId) {
    throw new Error(`Alert channel was not created: ${channel.error?.message}`);
  }
  await project.addAlert({
    organizationSlug: slugs.organization,
    projectSlug: slugs.project,
    targetSlug: slugs.target,
    channelId,
    type: AlertType.SchemaChangeNotifications,
  });

  await project.createDocumentCollection({
    name: 'Visual collection',
    description: 'Seeded for screenshot tests',
  });

  const [latestVersion] = await project.fetchVersions(1, {
    slug: slugs.target,
    id: project.target.id,
  });
  if (!latestVersion) {
    throw new Error('No schema version after publishing');
  }

  return {
    slugs,
    accessToken: owner.ownerToken,
    refreshToken: owner.ownerRefreshToken,
    email: owner.ownerEmail,
    schemaCheckId,
    schemaVersionId: latestVersion.id,
  };
}

type Route = { name: string; path: string; anonymous?: boolean };

function routesFor(seeded: Seeded): Route[] {
  const { slugs } = seeded;
  const org = `/${slugs.organization}`;
  const project = `${org}/${slugs.project}`;
  const target = `${project}/${slugs.target}`;

  return [
    { name: 'auth-sign-in', path: '/auth/sign-in', anonymous: true },
    { name: 'auth-sign-up', path: '/auth/sign-up', anonymous: true },
    { name: 'auth-reset-password', path: '/auth/reset-password', anonymous: true },
    { name: 'not-found', path: '/404', anonymous: true },

    { name: 'home', path: '/' },
    { name: 'org-new', path: '/org/new' },

    { name: 'org', path: org },
    { name: 'org-support', path: `${org}/view/support` },
    { name: 'org-members', path: `${org}/view/members` },
    { name: 'org-members-roles', path: `${org}/view/members/roles` },
    { name: 'org-members-groups', path: `${org}/view/members/groups` },
    { name: 'org-members-invitations', path: `${org}/view/members/invitations` },
    { name: 'org-settings', path: `${org}/view/settings` },
    { name: 'org-settings-sso', path: `${org}/view/settings/sso` },
    { name: 'org-settings-policy', path: `${org}/view/settings/policy` },
    { name: 'org-settings-access-tokens', path: `${org}/view/settings/access-tokens` },
    {
      name: 'org-settings-personal-access-tokens',
      path: `${org}/view/settings/personal-access-tokens`,
    },

    { name: 'project', path: project },
    { name: 'project-settings', path: `${project}/view/settings` },
    { name: 'project-settings-policy', path: `${project}/view/settings/policy` },
    { name: 'project-settings-composition', path: `${project}/view/settings/composition` },
    { name: 'project-settings-access-tokens', path: `${project}/view/settings/access-tokens` },
    { name: 'project-alerts', path: `${project}/view/alerts` },

    { name: 'target', path: target },
    { name: 'target-settings', path: `${target}/settings` },
    { name: 'target-settings-cdn', path: `${target}/settings/cdn` },
    { name: 'target-settings-registry-token', path: `${target}/settings/registry-token` },
    { name: 'target-settings-breaking-changes', path: `${target}/settings/breaking-changes` },
    { name: 'target-settings-base-schema', path: `${target}/settings/base-schema` },
    { name: 'target-settings-schema-contracts', path: `${target}/settings/schema-contracts` },
    { name: 'target-laboratory', path: `${target}/laboratory` },
    { name: 'target-history', path: `${target}/history` },
    { name: 'target-history-version', path: `${target}/history/${seeded.schemaVersionId}` },
    { name: 'target-insights', path: `${target}/insights` },
    { name: 'target-insights-manage-filters', path: `${target}/insights/manage-filters` },
    {
      name: 'target-insights-coordinate',
      path: `${target}/insights/schema-coordinate/Query.allProducts`,
    },
    { name: 'target-insights-client', path: `${target}/insights/client/visual-client` },
    { name: 'target-traces', path: `${target}/traces` },
    { name: 'target-explorer', path: `${target}/explorer` },
    { name: 'target-explorer-type', path: `${target}/explorer/Query` },
    { name: 'target-explorer-deprecated', path: `${target}/explorer/deprecated` },
    { name: 'target-explorer-unused', path: `${target}/explorer/unused` },
    { name: 'target-checks', path: `${target}/checks` },
    { name: 'target-checks-single', path: `${target}/checks/${seeded.schemaCheckId}` },
    {
      name: 'target-checks-affected-deployments',
      path: `${target}/checks/${seeded.schemaCheckId}/affected-deployments`,
    },
    { name: 'target-apps', path: `${target}/apps` },
    { name: 'target-proposals', path: `${target}/proposals` },
    { name: 'target-proposals-new', path: `${target}/proposals/new` },
    { name: 'target-alerts', path: `${target}/alerts` },
    { name: 'target-alerts-rules', path: `${target}/alerts/rules` },
    { name: 'target-alerts-create', path: `${target}/alerts/create` },
  ];
}

function volatileRegions(page: Page, seeded: Seeded): Locator[] {
  return [
    page.locator('time'),
    page.locator('canvas'),
    page.locator('.monaco-editor'),
    page.getByText(seeded.email),
    page.getByText(DATE_PATTERN),
  ];
}

let seeded: Seeded;

test.beforeAll(async () => {
  seeded = await seedVisualTarget();
});

test.describe('routes', () => {
  // Routes are only known once seeding has run, so the test list is built lazily from a stand-in
  // and the real paths are resolved inside each test.
  const routeNames = routesFor({
    slugs: SLUGS,
    accessToken: '',
    refreshToken: '',
    email: '',
    schemaCheckId: 'check',
    schemaVersionId: 'version',
  }).map(route => route.name);

  for (const routeName of routeNames) {
    for (const theme of THEMES) {
      test(`${routeName} [${theme}]`, async ({ page, auth }) => {
        const route = routesFor(seeded).find(candidate => candidate.name === routeName)!;

        if (!route.anonymous) {
          await auth.useSession({
            refreshToken: seeded.refreshToken,
            accessToken: seeded.accessToken,
          });
        }
        await page.addInitScript(theme => localStorage.setItem('hive-theme', theme), theme);

        await page.goto(route.path, { waitUntil: 'networkidle' });
        await page.locator('#root > *').first().waitFor({ state: 'attached' });
        await expect(page.locator('html')).toHaveClass(
          theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
        );
        // Route and section spinners are gone once the page has decided what it is.
        await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
        await expect.soft(page.getByText(/something went wrong/i)).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);

        await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
          mask: volatileRegions(page, seeded),
        });
      });
    }
  }
});
