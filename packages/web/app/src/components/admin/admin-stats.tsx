import { ReactElement, useMemo, useRef } from 'react';
import { useQuery } from 'urql';
import { DataTable } from '@/components/ui/data-table/data-table';
import { DataTableCell } from '@/components/ui/data-table/data-table-cell';
import { DataWrapper } from '@/components/ui/data-wrapper';
import { TimeSeriesChart } from '@/components/ui/primitives/chart/time-series-chart';
import Stat from '@/components/ui/stat';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';
import type { ColumnDef } from '@tanstack/react-table';
import * as styles from './admin-stats.css';

interface Organization {
  id: string;
  slug: string;
  owner: string;
  users: number;
  projects: number;
  targets: number;
  versions: number;
  persistedOperations: number;
  operations: number;
}

function formatNumber(value: number) {
  return Intl.NumberFormat().format(value);
}

function sumByKey<
  T extends {
    [key in K]: number;
  },
  K extends keyof T,
>(list: T[], key: K): number {
  return list.reduce((total, node) => total + node[key], 0);
}

export type Filters = Partial<{
  'with-projects': boolean;
  'with-targets': boolean;
  'with-schema-pushes': boolean;
  'with-persisted': boolean;
  'with-collected': boolean;
}>;

const CollectedOperationsOverTime_OperationFragment = graphql(`
  fragment CollectedOperationsOverTime_OperationFragment on AdminOperationPoint {
    count
    date
  }
`);

function CollectedOperationsOverTime(props: {
  operations: FragmentType<typeof CollectedOperationsOverTime_OperationFragment>[];
}): ReactElement {
  const operations = useFragment(CollectedOperationsOverTime_OperationFragment, props.operations);
  const dataRef = useRef<[string, number][]>();
  dataRef.current ||= operations.map(node => [node.date, node.count]);
  const data = dataRef.current;

  return (
    <TimeSeriesChart
      kind="area"
      valueFormatter={formatNumber}
      series={[{ name: 'Collected operations', data }]}
    />
  );
}

function OverallStat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <Stat>
      <Stat.Label>{label}</Stat.Label>
      <Stat.Number>{formatNumber(value)}</Stat.Number>
    </Stat>
  );
}

const AdminStatsQuery = graphql(`
  query adminStats($period: DateRangeInput!, $resolution: Int!) {
    admin {
      stats(period: $period, resolution: $resolution) {
        organizations {
          organization {
            id
            slug
            owner {
              id
              user {
                id
                email
              }
            }
          }
          versions
          users
          projects
          targets
          persistedOperations
          operations
        }
        general {
          operationsOverTime {
            ...CollectedOperationsOverTime_OperationFragment
          }
        }
      }
    }
  }
`);

function filterStats(
  row: DocumentType<typeof AdminStatsQuery>['admin']['stats']['organizations'][0],
  filters: Filters,
) {
  if (filters['with-projects'] && row.projects === 0) {
    return false;
  }

  if (filters['with-targets'] && row.targets === 0) {
    return false;
  }

  if (filters['with-schema-pushes'] && row.versions === 0) {
    return false;
  }

  if (filters['with-persisted'] && row.persistedOperations === 0) {
    return false;
  }

  if (filters['with-collected'] && row.operations === 0) {
    return false;
  }

  return true;
}

const countColumn = (
  key: 'users' | 'projects' | 'targets' | 'versions' | 'persistedOperations' | 'operations',
  header: string,
): ColumnDef<Organization, unknown> => ({
  accessorKey: key,
  header,
  meta: { align: 'right', sortable: true },
  cell: ({ row }) => <DataTableCell kind="number" value={row.original[key]} />,
});

const ORGANIZATION_COLUMNS: ColumnDef<Organization, unknown>[] = [
  {
    accessorKey: 'slug',
    header: 'Organization',
    meta: { sortable: true },
    cell: ({ row }) => <DataTableCell kind="text" value={row.original.slug} weight="medium" />,
  },
  {
    id: 'id',
    header: 'ID',
    cell: ({ row }) => (
      <DataTableCell kind="copy" value={row.original.id} label={row.original.id.slice(0, 8)} />
    ),
  },
  {
    accessorKey: 'owner',
    header: 'Owner',
    // The email is the longest thing on the row, so it takes the leftover width and truncates.
    meta: { sortable: true, width: 'fill' },
    cell: ({ row }) => (
      <DataTableCell kind="text" value={row.original.owner} mono tone="muted" truncate />
    ),
  },
  countColumn('users', 'Users'),
  countColumn('projects', 'Projects'),
  countColumn('targets', 'Targets'),
  countColumn('versions', 'Schema pushes'),
  countColumn('persistedOperations', 'Persisted Ops'),
  countColumn('operations', 'Collected Ops'),
];

function OrganizationTable({ data }: { data: Organization[] }) {
  return (
    <DataTable
      data={data}
      columns={ORGANIZATION_COLUMNS}
      getRowId={organization => organization.id}
      pagination={{ kind: 'client', pageSize: 20 }}
      emptyMessage="No organizations match the filters."
    />
  );
}

export function AdminStats({
  dateRange,
  resolution,
  filters,
}: {
  dateRange: {
    from: string;
    to: string;
  };
  resolution: number;
  filters: Filters;
}): ReactElement {
  const [query] = useQuery({
    query: AdminStatsQuery,
    variables: {
      period: {
        from: dateRange.from,
        to: dateRange.to,
      },
      resolution,
    },
  });

  const tableData = useMemo(
    () =>
      (query.data?.admin?.stats.organizations ?? [])
        .filter(node => filterStats(node, filters))
        .map(node => ({
          id: node.organization.id,
          slug: node.organization.slug,
          owner: node.organization.owner.user.email,
          users: node.users,
          projects: node.projects,
          targets: node.targets,
          versions: node.versions,
          persistedOperations: node.persistedOperations,
          operations: node.operations,
        })),
    [query.data, filters],
  );

  const overall = useMemo(
    () => ({
      users: sumByKey(tableData, 'users'),
      organizations: tableData.length,
      projects: sumByKey(tableData, 'projects'),
      targets: sumByKey(tableData, 'targets'),
      versions: sumByKey(tableData, 'versions'),
      persistedOperations: sumByKey(tableData, 'persistedOperations'),
      operations: sumByKey(tableData, 'operations'),
    }),
    [tableData],
  );

  return (
    <DataWrapper query={query} organizationSlug={null}>
      {({ data }) => (
        <div className={styles.adminStatsDiv}>
          <div className={styles.adminStatsDiv2}>
            <OverallStat label="Users" value={overall.users} />
            <OverallStat label="Organizations" value={overall.organizations} />
            <OverallStat label="Projects" value={overall.projects} />
            <OverallStat label="Targets" value={overall.targets} />
            <OverallStat label="Schema Pushes" value={overall.versions} />
            <OverallStat label="Persisted Ops" value={overall.persistedOperations} />
            <OverallStat label="Collected Ops" value={overall.operations} />
          </div>
          <CollectedOperationsOverTime operations={data.admin.stats.general.operationsOverTime} />
          <OrganizationTable data={tableData} />
        </div>
      )}
    </DataWrapper>
  );
}
