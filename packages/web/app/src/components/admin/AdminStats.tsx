import 'twin.macro';
import { Table, Thead, Tbody, Th, Tr, Td, Flex, StatGroup, Stat, StatLabel, StatNumber } from '@chakra-ui/react';
import ReactECharts from 'echarts-for-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';
import {
  createTable,
  useTableInstance,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  TableInstance as OriginalTableInstance,
  Table as OriginalTable,
} from '@tanstack/react-table';
import React from 'react';
import { DocumentType, gql, useQuery } from 'urql';
import { VscChevronUp, VscChevronDown } from 'react-icons/vsc';
import { DataWrapper } from '@/components/common/DataWrapper';
import { theme } from '@/lib/charts';
import { OrganizationType } from '@/graphql';

interface Organization {
  name: string;
  members: string;
  type: OrganizationType;
  users: number;
  projects: number;
  targets: number;
  versions: number;
  persistedOperations: number;
  operations: any;
}

const table = createTable().setRowType<Organization>();

type TableInstance = typeof table extends OriginalTable<infer T> ? OriginalTableInstance<T> : never;

function formatNumber(value: number) {
  return Intl.NumberFormat().format(value);
}

function sumByKey<
  T extends {
    [key in K]: number;
  },
  K extends keyof T
>(list: T[], key: K): number {
  return list.reduce((total, node) => total + node[key], 0);
}

export type Filters = Partial<{
  'only-regular': boolean;
  'with-projects': boolean;
  'with-targets': boolean;
  'with-schema-pushes': boolean;
  'with-persisted': boolean;
  'with-collected': boolean;
}>;

const CollectedOperationsOverTime_OperationFragment = gql(/* GraphQL */ `
  fragment CollectedOperationsOverTime_OperationFragment on AdminOperationPoint {
    count
    date
  }
`);

const CollectedOperationsOverTime: React.FC<{
  last: number;
  operations: Array<DocumentType<typeof CollectedOperationsOverTime_OperationFragment>>;
}> = ({ last, operations }) => {
  const period = {
    from: new Date(Date.now() - (last === 0 ? 30 : last) * 24 * 60 * 60 * 1000),
    to: new Date(),
  };

  const data = React.useMemo(() => {
    return operations.map<[string, number]>(node => [node.date, node.count]);
  }, []);

  return (
    <AutoSizer disableHeight>
      {size => (
        <ReactECharts
          style={{ width: size.width, height: 200 }}
          theme={theme.theme}
          option={{
            grid: {
              left: 50,
              top: 50,
              right: 20,
              bottom: 20,
            },
            tooltip: {
              trigger: 'axis',
            },
            legend: {},
            xAxis: [
              {
                type: 'time',
                boundaryGap: false,
                min: period.from,
                max: period.to,
              },
            ],
            yAxis: [
              {
                type: 'value',
                min: 0,
              },
            ],
            series: [
              {
                type: 'line',
                name: 'Collected operations',
                showSymbol: false,
                smooth: true,
                color: 'rgb(234, 179, 8)',
                areaStyle: {},
                emphasis: {
                  focus: 'series',
                },
                large: true,
                data,
              },
            ],
          }}
        />
      )}
    </AutoSizer>
  );
};

const OverallStat: React.FC<{
  label: string;
  value: number;
}> = ({ label, value }) => {
  return (
    <Stat>
      <StatLabel>{label}</StatLabel>
      <StatNumber>{formatNumber(value)}</StatNumber>
    </Stat>
  );
};

const Sortable: React.FC<{
  align?: 'center' | 'right' | 'left';
  isSortedDesc?: boolean;
  isSorted?: boolean;
}> = ({ children, isSorted, isSortedDesc, align = 'left' }) => {
  return (
    <Flex
      direction="row"
      align="center"
      justifyContent={align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end'}
      tw="cursor-pointer"
    >
      <span>{children}</span>
      {isSorted ? isSortedDesc ? <VscChevronDown /> : <VscChevronUp /> : null}
    </Flex>
  );
};

const AdminStatsQuery = gql(/* GraphQL */ `
  query adminStats($last: Int) {
    admin {
      stats(daysLimit: $last) {
        organizations {
          organization {
            id
            cleanId
            name
            type
            owner {
              user {
                email
              }
            }
            members {
              nodes {
                user {
                  id
                  email
                }
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
  filters: Filters
) {
  if (filters['only-regular'] && row.organization.type !== 'REGULAR') {
    return false;
  }

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

function Row({ tableInstance, index }: { tableInstance: TableInstance; index: string }) {
  const row = tableInstance.getRowModel().rows[index];
  return (
    <Tr key={row.id}>
      {row.getVisibleCells().map(cell => {
        const isNumeric = typeof cell.getValue() === 'number';
        return (
          <Td
            key={cell.id}
            isNumeric={isNumeric}
            align={(cell.column.columnDef.meta as { align: 'right' } | undefined)?.align ?? 'left'}
          >
            {isNumeric ? formatNumber(cell.getValue() as number) : cell.renderCell()}
          </Td>
        );
      })}
    </Tr>
  );
}

function AdminTable({
  rowCount,
  tableInstance,
}: {
  tableInstance: TableInstance;
  rowCount: number;
  sorting: SortingState;
}) {
  const Inner = React.useCallback(({ children }) => {
    const headerGroup = tableInstance.getHeaderGroups()[0];

    return (
      <Table size="sm">
        <Thead>
          <Tr>
            {headerGroup.headers.map(header => {
              const align =
                (
                  header.column.columnDef.meta as
                    | {
                        align: 'right';
                      }
                    | undefined
                )?.align ?? 'left';

              return (
                <Th key={header.id} align={align} onClick={header.column.getToggleSortingHandler()}>
                  <Sortable
                    align={align}
                    isSorted={header.column.getIsSorted() !== false}
                    isSortedDesc={header.column.getIsSorted() === 'desc'}
                  >
                    {header.renderHeader()}
                  </Sortable>
                </Th>
              );
            })}
          </Tr>
        </Thead>
        <Tbody>{children}</Tbody>
      </Table>
    );
  }, []);

  return (
    <AutoSizer>
      {({ height, width }) => (
        <FixedSizeList
          innerElementType={Inner}
          height={height}
          width={width}
          itemCount={rowCount}
          itemSize={24}
          overscanCount={10}
        >
          {({ index }) => <Row tableInstance={tableInstance} index={index as any} />}
        </FixedSizeList>
      )}
    </AutoSizer>
  );
}

export const AdminStats: React.FC<{
  last: number;
  filters: Filters;
}> = ({ last, filters }) => {
  const [query] = useQuery({
    query: AdminStatsQuery,
    variables: {
      last: last === 0 ? null : last,
    },
  });

  const columns = React.useMemo(
    () => [
      table.createDataColumn('name', {
        header: 'Organization',
        footer: props => props.column.id,
      }),
      table.createDataColumn('type', {
        header: 'Type',
        footer: props => props.column.id,
      }),
      table.createDataColumn('members', {
        header: 'Members',
        footer: props => props.column.id,
        meta: {
          align: 'right',
        },
      }),
      table.createDataColumn('users', {
        header: 'Users',
        footer: props => props.column.id,
      }),
      table.createDataColumn('projects', {
        header: 'Projects',
        footer: props => props.column.id,
        meta: {
          align: 'right',
        },
      }),
      table.createDataColumn('targets', {
        header: 'Targets',
        footer: props => props.column.id,
        meta: {
          align: 'right',
        },
      }),
      table.createDataColumn('versions', {
        header: 'Schema pushes',
        footer: props => props.column.id,
        meta: {
          align: 'right',
        },
      }),
      table.createDataColumn('persistedOperations', {
        header: 'Persisted Ops',
        footer: props => props.column.id,
        meta: {
          align: 'right',
        },
      }),
      table.createDataColumn('operations', {
        header: 'Collected Ops',
        footer: props => props.column.id,
        meta: {
          align: 'right',
        },
      }),
    ],
    []
  );

  const data = React.useMemo(() => {
    return (query.data?.admin?.stats.organizations ?? [])
      .filter(node => filterStats(node, filters))
      .map(node => ({
        name: `${node.organization.name} (id: ${node.organization.cleanId}, owner: ${node.organization.owner.user.email})`,
        members: (node.organization.members.nodes || []).map(v => v.user.email).join(', '),
        type: node.organization.type,
        users: node.users,
        projects: node.projects,
        targets: node.targets,
        versions: node.versions,
        persistedOperations: node.persistedOperations,
        operations: node.operations,
      }));
  }, [query.data, filters]);

  const [sorting, setSorting] = React.useState<SortingState>([]);

  const tableInstance = useTableInstance(table, {
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
    debugAll: true,
  });

  const overall = React.useMemo(() => {
    return {
      users: data.reduce((total, node) => (node.type === 'PERSONAL' ? total + 1 : total), 0),
      organizations: data.length,
      projects: sumByKey(data, 'projects'),
      targets: sumByKey(data, 'targets'),
      versions: sumByKey(data, 'versions'),
      persistedOperations: sumByKey(data, 'persistedOperations'),
      operations: sumByKey(data, 'operations'),
    };
  }, [data]);

  return (
    <DataWrapper query={query}>
      {() => (
        <div tw="flex flex-col space-y-6">
          <StatGroup tw="bg-gray-100 dark:bg-gray-800 px-3 py-2">
            <OverallStat label="Users" value={overall.users} />
            <OverallStat label="Organizations" value={overall.organizations} />
            <OverallStat label="Projects" value={overall.projects} />
            <OverallStat label="Targets" value={overall.targets} />
            <OverallStat label="Schema Pushes" value={overall.versions} />
            <OverallStat label="Persisted Ops" value={overall.persistedOperations} />
            <OverallStat label="Collected Ops" value={overall.operations} />
          </StatGroup>
          <CollectedOperationsOverTime last={last} operations={query.data?.admin.stats.general.operationsOverTime} />
          <AdminTable tableInstance={tableInstance} rowCount={data.length} sorting={sorting} />
        </div>
      )}
    </DataWrapper>
  );
};
