// @vitest-environment jsdom
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { renderAtUrl } from '@/lib/testing/router';
import { pickOption } from '@/lib/testing/select';
import { createTestClient } from '@/lib/testing/urql';
import { fireEvent, screen, waitFor } from '@testing-library/react';

// The tree imports every page; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);
vi.mock('@/components/schema-editor', async importOriginal => ({
  ...(await importOriginal<typeof import('@/components/schema-editor')>()),
  SchemaEditor: () => null,
}));
vi.mock('supertokens-auth-react', () => import('@/lib/testing/mocks/supertokens'));
vi.mock('supertokens-auth-react/recipe/session', () => import('@/lib/testing/mocks/session'));

const SCHEMA_PAGE = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}`;

/** A federation project whose latest version has a `users` and a `products` service. */
function schemaPage() {
  const edges = ['users', 'products'].map(service => ({
    __typename: 'SchemaEdge',
    node: {
      __typename: 'CompositeSchema',
      id: `schema-${service}`,
      source: `type Query { ${service}: String }`,
      service,
      url: `https://${service}.example`,
    },
  }));
  return {
    __typename: 'Query',
    project: {
      __typename: 'Project',
      id: 'project-1',
      type: 'FEDERATION',
      target: {
        __typename: 'Target',
        id: 'target-1',
        slug: SLUGS.targetSlug,
        latestSchemaVersion: {
          __typename: 'SchemaVersion',
          id: 'version-42',
          schemas: { __typename: 'SchemaConnection', edges },
        },
      },
    },
  };
}

function client() {
  return createTestClient(new Map([...layoutFixtures(), ['TargetSchemaPageQuery', schemaPage()]]));
}

// The select's trigger echoes the picked name, so a service is its header's deep-link anchor.
const serviceHeader = (name: string) => document.getElementById(`service-${name}`);
const clearButton = () => screen.queryByRole('button', { name: 'Clear service' });

describe('target schema page', () => {
  it('filters the services to the one picked, and clears back', { timeout: 30_000 }, async () => {
    const { router } = renderAtUrl(SCHEMA_PAGE, { client: client() });
    await waitFor(() => expect(serviceHeader('users')).toBeTruthy());
    expect(serviceHeader('products')).toBeTruthy();
    expect(clearButton()).toBeNull();

    await pickOption('Service', /^products/);

    await waitFor(() => expect(router.state.location.search).toEqual({ service: 'products' }));
    await waitFor(() => expect(serviceHeader('users')).toBeNull());
    expect(serviceHeader('products')).toBeTruthy();
    expect(clearButton()).toBeTruthy();

    fireEvent.click(clearButton()!);

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(serviceHeader('users')).toBeTruthy());
    expect(serviceHeader('products')).toBeTruthy();
    expect(clearButton()).toBeNull();
  });

  it('lands filtered from a deep link', { timeout: 30_000 }, async () => {
    renderAtUrl(`${SCHEMA_PAGE}?service=users`, { client: client() });
    await waitFor(() => expect(serviceHeader('users')).toBeTruthy());
    expect(serviceHeader('products')).toBeNull();
    expect(clearButton()).toBeTruthy();
  });
});
