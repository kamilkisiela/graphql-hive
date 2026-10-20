// @vitest-environment jsdom
import { makeFragmentData } from '@/gql';
import { SchemaChangeKind, SeverityLevelType } from '@/gql/graphql';
import { render, screen } from '@testing-library/react';
import {
  ChangesBlock,
  ChangesBlock_SchemaChangeWithUsageFragment,
  CompositionErrorsList,
  labelize,
} from './errors-and-changes';

vi.mock('@/lib/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/hooks')>()),
  useSlugs: () => ({ organizationSlug: 'acme', projectSlug: 'shop', targetSlug: 'production' }),
}));

describe('labelize', () => {
  it('wraps single- and double-quoted segments in a Label and drops the quotes', () => {
    const { container } = render(<>{labelize('Field "User.id" conflicts with \'Account.id\'')}</>);
    const labels = [...container.querySelectorAll('span')].map(label => label.textContent);
    expect(labels).toEqual(['User.id', 'Account.id']);
    expect(container.textContent).toBe('Field User.id conflicts with Account.id');
  });

  it('leaves a message without quotes untouched', () => {
    const { container } = render(<>{labelize('Composition succeeded')}</>);
    expect(container.querySelectorAll('span')).toHaveLength(0);
    expect(container.textContent).toBe('Composition succeeded');
  });
});

describe('CompositionErrorsList', () => {
  it('renders the title and lifts a satisfiability query into a code block', () => {
    const query = '{\n  user {\n    orders\n  }\n}';
    const { container, getByText } = render(
      <CompositionErrorsList
        title="Composition Errors"
        errors={[
          {
            message: `The following supergraph API query:\n${query}\ncannot be satisfied by the subgraphs because:\n- from subgraph "users": cannot find field "User.orders".`,
          },
        ]}
      />,
    );
    getByText('Composition Errors');
    expect(container.querySelector('pre')?.textContent).toBe(query);
    // The same section heading as the change lists, with its explainer beside it.
    const heading = container.querySelector('[data-cy="composition-errors-title"]')!;
    expect(heading.textContent).toContain('Composition Errors');
    expect(heading.querySelector('[data-cy="composition-errors-info"]')).toBeTruthy();
  });
});

describe('ChangesBlock', () => {
  it('puts the deployment count beside the other badges, not in the message', () => {
    const change = makeFragmentData(
      {
        __typename: 'SchemaChange' as const,
        path: ['User', 'legacyId'],
        message: "Field 'legacyId' was removed from object type 'User'",
        severityLevel: SeverityLevelType.Breaking,
        severityReason: 'Removing a field is a breaking change.',
        isSafeBasedOnUsage: false,
        isUsageTracked: true,
        kind: SchemaChangeKind.FieldRemoved,
        approval: null,
        usageStatistics: {
          __typename: 'SchemaChangeUsageStatistics' as const,
          schemaCoordinate: 'User.legacyId',
          topAffectedOperations: [
            {
              __typename: 'SchemaChangeUsageStatisticsAffectedOperation' as const,
              hash: 'a0ec',
              name: 'GetUser',
              countFormatted: '12',
              percentageFormatted: '100%',
              affectedTargets: null,
            },
          ],
          topAffectedClients: [
            {
              __typename: 'SchemaChangeUsageStatisticsAffectedClient' as const,
              name: 'webapp',
              countFormatted: '12',
              percentageFormatted: '100%',
            },
          ],
          affectedTargets: null,
        },
        affectedAppDeployments: {
          __typename: 'SchemaChangeAffectedAppDeploymentsConnection' as const,
          totalCount: 101,
          edges: [],
        },
      },
      ChangesBlock_SchemaChangeWithUsageFragment,
    );
    render(<ChangesBlock changesWithUsage={[change]} />);
    const deployments = screen.getByText('101 deployments');
    const clients = screen.getByText('1 client');
    expect(deployments.parentElement).toBe(clients.parentElement);
    expect(screen.getByText(/was removed from object type/).textContent).toBe(
      'Field legacyId was removed from object type User',
    );
  });
});
