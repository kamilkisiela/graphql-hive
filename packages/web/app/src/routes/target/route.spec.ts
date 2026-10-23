// @vitest-environment jsdom
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

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

function compositeSchema(service: string) {
  return {
    __typename: 'SchemaEdge' as const,
    node: {
      __typename: 'CompositeSchema' as const,
      id: `schema-${service}`,
      source: `type Query { ${service}: String }`,
      service,
      url: `https://${service}.example`,
    },
  };
}

function schemaPage() {
  return {
    __typename: 'Query' as const,
    project: {
      __typename: 'Project' as const,
      id: 'project-1',
      type: 'FEDERATION',
      target: {
        __typename: 'Target' as const,
        id: 'target-1',
        slug: SLUGS.targetSlug,
        latestSchemaVersion: {
          __typename: 'SchemaVersion' as const,
          id: 'version-42',
          schemas: {
            __typename: 'SchemaConnection' as const,
            edges: [compositeSchema('users'), compositeSchema('products')],
          },
        },
      },
    },
  };
}

function client() {
  return createTestClient(new Map([...layoutFixtures(), ['TargetSchemaPageQuery', schemaPage()]]));
}

// Base UI commits an option only while it is highlighted, so focus and click are separate acts.
// An option is named by its label and its URL.
async function pickService(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Service' }));
  });
  const option = await screen.findByRole('option', { name: new RegExp(`^${name}`) });
  await act(async () => {
    option.focus();
  });
  await act(async () => {
    fireEvent.click(option);
  });
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

    await pickService('products');

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
