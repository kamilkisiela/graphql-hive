import 'twin.macro';
import React, { PropsWithChildren, ReactNode } from 'react';
import {
  Table,
  Thead,
  Tbody,
  Th,
  Tr,
  Td,
  Flex,
  StatGroup,
  Stat,
  StatLabel,
  StatNumber,
  Button,
  IconButton,
} from '@chakra-ui/react';
import ReactECharts from 'echarts-for-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  createTable,
  useTableInstance,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  PaginationState,
  TableInstance as OriginalTableInstance,
  Table as OriginalTable,
} from '@tanstack/react-table';
import { DocumentType, gql, useQuery } from 'urql';
import { formatISO } from 'date-fns';
import { VscChevronUp, VscChevronDown, VscChevronLeft, VscChevronRight } from 'react-icons/vsc';
import { DataWrapper } from '@/components/common/DataWrapper';
import { theme } from '@/lib/charts';
import { OrganizationType } from '@/graphql';
import { env } from '@/env/frontend';

interface Organization {
  name: React.ReactElement;
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
  K extends keyof T,
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
  dateRange: {
    from: Date;
    to: Date;
  };
  operations: Array<DocumentType<typeof CollectedOperationsOverTime_OperationFragment>>;
}> = ({ dateRange, operations }) => {
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
                min: dateRange.from,
                max: dateRange.to,
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

const Sortable = ({
  children,
  isSorted,
  isSortedDesc,
  align = 'left',
}: PropsWithChildren<{
  align?: 'center' | 'right' | 'left';
  isSortedDesc?: boolean;
  isSorted?: boolean;
}>) => {
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
  query adminStats($period: DateRangeInput!) {
    admin {
      stats(period: $period) {
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
  filters: Filters,
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

function OrganizationTableRow({ row }: { row: ReturnType<TableInstance['getRow']> }) {
  return (
    <Tr key={row.id}>
      {row.getVisibleCells().map(cell => {
        const isNumeric = typeof cell.getValue() === 'number';
        const isReact =
          typeof cell.getValue() === 'object' && React.isValidElement(cell.getValue());
        return (
          <Td
            key={cell.id}
            isNumeric={isNumeric}
            align={(cell.column.columnDef.meta as { align: 'right' } | undefined)?.align ?? 'left'}
          >
            {isNumeric
              ? formatNumber(cell.getValue() as number)
              : isReact
              ? (cell.getValue() as ReactNode)
              : cell.renderCell()}
          </Td>
        );
      })}
    </Tr>
  );
}

function OrganizationTable({ data }: { data: Organization[] }) {
  const columns = React.useMemo(
    () => [
      table.createDataColumn('name', {
        header: 'Organization',
        footer: props => props.column.id,
        enableSorting: false,
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
    [],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const tableInstance = useTableInstance(table, {
    data,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: env.nodeEnv !== 'production',
  });

  const firstPage = React.useCallback(() => {
    tableInstance.setPageIndex(0);
  }, [tableInstance]);
  const lastPage = React.useCallback(() => {
    tableInstance.setPageIndex(tableInstance.getPageCount() - 1);
  }, [tableInstance]);

  const headerGroup = tableInstance.getHeaderGroups()[0];

  return (
    <div>
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
        <Tbody>
          {tableInstance.getRowModel().rows.map(row => (
            <OrganizationTableRow row={row} key={row.id} />
          ))}
        </Tbody>
      </Table>
      <div tw="py-3 flex flex-row items-center justify-center space-x-2">
        <Button
          size="sm"
          variant="ghost"
          colorScheme="gray"
          onClick={firstPage}
          disabled={!tableInstance.getCanPreviousPage()}
        >
          First
        </Button>
        <IconButton
          size="sm"
          variant="ghost"
          colorScheme="gray"
          aria-label="Go to previous page"
          onClick={tableInstance.previousPage}
          disabled={!tableInstance.getCanPreviousPage()}
          icon={<VscChevronLeft />}
        />
        <span tw="font-bold whitespace-nowrap text-sm">
          {tableInstance.getState().pagination.pageIndex + 1} / {tableInstance.getPageCount()}
        </span>
        <IconButton
          size="sm"
          variant="ghost"
          colorScheme="gray"
          aria-label="Go to next page"
          onClick={tableInstance.nextPage}
          disabled={!tableInstance.getCanNextPage()}
          icon={<VscChevronRight />}
        />
        <Button
          size="sm"
          variant="ghost"
          colorScheme="gray"
          onClick={lastPage}
          disabled={!tableInstance.getCanNextPage()}
        >
          Last
        </Button>
      </div>
    </div>
  );
}

export const AdminStats: React.FC<{
  dateRange: {
    from: Date;
    to: Date;
  };
  filters: Filters;
}> = ({ dateRange, filters }) => {
  const [query] = useQuery({
    query: AdminStatsQuery,
    variables: {
      period: {
        from: formatISO(dateRange.from),
        to: formatISO(dateRange.to),
      },
    },
  });

  const tableData = React.useMemo(() => {
    return (query.data?.admin?.stats.organizations ?? [])
      .filter(node => filterStats(node, filters))
      .map(node => ({
        name: (
          <div>
            <div style={{ paddingBottom: 5, fontWeight: 'bold' }}>{node.organization.name}</div>
            <pre title="id">{node.organization.id}</pre>
            <pre title="clean id">{node.organization.cleanId}</pre>
            <pre title="owner">{node.organization.owner.user.email}</pre>
          </div>
        ),
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

  const overall = React.useMemo(() => {
    return {
      users: tableData.reduce((total, node) => (node.type === 'PERSONAL' ? total + 1 : total), 0),
      organizations: tableData.length,
      projects: sumByKey(tableData, 'projects'),
      targets: sumByKey(tableData, 'targets'),
      versions: sumByKey(tableData, 'versions'),
      persistedOperations: sumByKey(tableData, 'persistedOperations'),
      operations: sumByKey(tableData, 'operations'),
    };
  }, [tableData]);

  return (
    <DataWrapper query={query}>
      {({ data }) => (
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
          <CollectedOperationsOverTime
            dateRange={dateRange}
            operations={data.admin.stats.general.operationsOverTime}
          />
          <OrganizationTable data={tableData} />
        </div>
      )}
    </DataWrapper>
  );
};
