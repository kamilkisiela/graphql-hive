// eslint-disable-next-line import/no-extraneous-dependencies -- required before loading seed helpers
import 'reflect-metadata';
import { test as base, expect, type Page } from '@playwright/test';
import { initSeed, ProjectType } from '../integration-tests/testkit/seed';
import { createAppHelper, type AppHelper } from './helpers/app';
import { createAuthHelper, type AuthHelper } from './helpers/auth';
import { createLaboratoryHelper, type LaboratoryHelper } from './helpers/laboratory';
import { createOIDCHelper, type OIDCHelper } from './helpers/oidc';
import { createUsageHelper, type UsageHelper } from './helpers/usage';

type SeedOwner = Awaited<ReturnType<ReturnType<typeof initSeed>['createOwner']>>;
type SeedOrg = Awaited<ReturnType<SeedOwner['createOrg']>>;
/** The testkit project handle, for seeding collections and preflight scripts through the API. */
export type SeedProject = Awaited<ReturnType<SeedOrg['createProject']>>;

export type SeedHelper = {
  seedOrg(): Promise<{ slug: string; accessToken: string; refreshToken: string; email: string }>;
  seedTarget(type?: ProjectType): Promise<{
    slug: string;
    accessToken: string;
    refreshToken: string;
    email: string;
    project: SeedProject;
    resources: {
      organizationId: string;
      projectId: string;
      targetId: string;
    };
  }>;
  getEmailConfirmationLink(input: string | { email: string; now: number }): Promise<string>;
  purgeOIDCDomains(): Promise<void>;
  purgeUserByEmail(email: string): Promise<void>;
  forgeOIDCDNSChallenge(orgSlug: string): Promise<void>;
};

type Fixtures = {
  frontendEnv: void;
  seed: SeedHelper;
  auth: AuthHelper;
  app: AppHelper;
  oidc: OIDCHelper;
  laboratory: LaboratoryHelper;
  usage: UsageHelper;
};

let seedHelperPromise: Promise<SeedHelper> | null = null;

function loadSeedHelper(): Promise<SeedHelper> {
  seedHelperPromise ??= createSeedHelper();
  return seedHelperPromise;
}

async function createSeedHelper(): Promise<SeedHelper> {
  const seed = initSeed();

  return {
    async seedOrg() {
      const owner = await seed.createOwner();
      const org = await owner.createOrg();
      await org.setFeatureFlag('scim', true);

      return {
        slug: org.organization.slug,
        accessToken: owner.ownerToken,
        refreshToken: owner.ownerRefreshToken,
        email: owner.ownerEmail,
      };
    },
    async seedTarget(projectType?: ProjectType) {
      const owner = await seed.createOwner();
      const org = await owner.createOrg();
      const project = await org.createProject(projectType);

      return {
        slug: `${org.organization.slug}/${project.project.slug}/${project.target.slug}`,
        accessToken: owner.ownerToken,
        refreshToken: owner.ownerRefreshToken,
        email: owner.ownerEmail,
        project,
        resources: {
          organizationId: org.organization.id,
          projectId: project.project.id,
          targetId: project.target.id,
        },
      };
    },
    async getEmailConfirmationLink(input) {
      const url = await seed.pollForEmailVerificationLink(input);

      return url.pathname + url.search;
    },
    async purgeOIDCDomains() {
      await seed.purgeOIDCDomains();
    },
    async purgeUserByEmail(email) {
      await seed.purgeUserByEmail(email);
    },
    async forgeOIDCDNSChallenge(orgSlug) {
      await seed.forgeOIDCDNSChallenge(orgSlug);
    },
  };
}

async function clearBrowserSession(page: Page) {
  await page.context().clearCookies();
  try {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  } catch {}
}

export const test = base.extend<Fixtures>({
  frontendEnv: [
    async ({ page }, use) => {
      await page.route('**/__env.js', async route => {
        const response = await route.fetch();
        const body = await response.text();
        const match = body.match(/^window\.__ENV = (.*);$/s);

        if (!match) {
          await route.fulfill({ response, body });
          return;
        }

        const env = JSON.parse(match[1]) as Record<string, unknown>;

        await route.fulfill({
          response,
          body: `window.__ENV = ${JSON.stringify({
            ...env,
            AUTH_ORGANIZATION_OIDC: '1',
          })};`,
        });
      });
      await page.route('https://unpkg.com/react-scan@*/dist/auto.global.js', async route => {
        await route.fulfill({
          contentType: 'application/javascript',
          body: '',
        });
      });

      await use();
    },
    { auto: true },
  ],
  seed: async ({ browserName: _browserName }, use) => {
    await use(await loadSeedHelper());
  },
  auth: async ({ page }, use, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    await use(createAuthHelper(page, loadSeedHelper, baseURL, clearBrowserSession));
  },
  app: async ({ page, auth }, use) => {
    await use(createAppHelper(page, auth));
  },
  oidc: async ({ page, seed, auth }, use) => {
    await use(createOIDCHelper(page, seed, auth));
  },
  laboratory: async ({ page }, use) => {
    await use(createLaboratoryHelper(page));
  },
  usage: async ({ page, request }, use, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    await use(createUsageHelper(page, request, baseURL));
  },
});

export { expect };
