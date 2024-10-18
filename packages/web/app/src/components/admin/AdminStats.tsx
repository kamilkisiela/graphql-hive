import {
  isValidElement,
  ReactElement,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactECharts from 'echarts-for-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import {
  DataWrapper,
  Sortable,
  Stat,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tooltip,
  Tr,
} from '@/components/v2';
import { CHART_PRIMARY_COLOR } from '@/constants';
import { env } from '@/env/frontend';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';
import { theme } from '@/lib/charts';
import { useChartStyles } from '@/utils';
import { ChevronUpIcon } from '@radix-ui/react-icons';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '../ui/button';

interface Organization {
  name: ReactElement;
  members: string;
  users: number;
  projects: number;
  targets: number;
  versions: number;
  persistedOperations: number;
  operations: any;
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
    <AutoSizer disableHeight>
      {size => (
        <ReactECharts
          style={{ width: size.width, height: 200 }}
          theme={theme.theme}
          option={{
            ...useChartStyles(),
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
              },
            ],
            yAxis: [
              {
                type: 'value',
                min: 0,
                splitLine: {
                  lineStyle: {
                    color: '#595959',
                    type: 'dashed',
                  },
                },
                axisLabel: {
                  formatter: (value: number) => formatNumber(value),
                },
              },
            ],
            series: [
              {
                type: 'line',
                name: 'Collected operations',
                showSymbol: false,
                smooth: true,
                color: CHART_PRIMARY_COLOR,
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
            members {
              nodes {
                id
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

const columnHelper = createColumnHelper<Organization>();

const columns = [
  columnHelper.accessor('name', {
    header: 'Organization',
    enableSorting: false,
  }),
  columnHelper.accessor('members', {
    header: 'Members',
  }),
  columnHelper.accessor('users', {
    header: 'Users',
    meta: { align: 'right' },
  }),
  columnHelper.accessor('projects', {
    header: 'Projects',
    meta: { align: 'right' },
  }),
  columnHelper.accessor('targets', {
    header: 'Targets',
    meta: { align: 'right' },
  }),
  columnHelper.accessor('versions', {
    header: 'Schema pushes',
    meta: { align: 'right' },
  }),
  columnHelper.accessor('persistedOperations', {
    header: 'Persisted Ops',
    meta: { align: 'right' },
  }),
  columnHelper.accessor('operations', {
    header: 'Collected Ops',
    meta: { align: 'right' },
  }),
];

function OrganizationTable({ data }: { data: Organization[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const tableInstance = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: env.nodeEnv !== 'production',
  });

  const firstPage = useCallback(() => {
    tableInstance.setPageIndex(0);
  }, [tableInstance]);
  const lastPage = useCallback(() => {
    tableInstance.setPageIndex(tableInstance.getPageCount() - 1);
  }, [tableInstance]);

  const { headers } = tableInstance.getHeaderGroups()[0];

  return (
    <>
      <Table>
        <THead>
          <Tooltip.Provider>
            {headers.map(header => {
              const align =
                (header.column.columnDef.meta as { align: 'right' } | undefined)?.align ?? 'left';
              const canSort = header.column.getCanSort();
              const name = flexRender(header.column.columnDef.header, header.getContext());
              return (
                <Th key={header.id} align={align}>
                  {canSort ? (
                    <Sortable
                      sortOrder={header.column.getIsSorted()}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {name}
                    </Sortable>
                  ) : (
                    name
                  )}
                </Th>
              );
            })}
          </Tooltip.Provider>
        </THead>
        <TBody>
          {tableInstance.getRowModel().rows.map(row => (
            <Tr key={row.id}>
              {row.getVisibleCells().map(cell => {
                const isNumeric = typeof cell.getValue() === 'number';
                const isReact =
                  typeof cell.getValue() === 'object' && isValidElement(cell.getValue());
                const align =
                  (cell.column.columnDef.meta as { align: 'right' } | undefined)?.align ?? 'left';
                return (
                  <Td key={cell.id} align={align}>
                    {isNumeric
                      ? formatNumber(cell.getValue() as number)
                      : isReact
                        ? (cell.getValue() as ReactNode)
                        : flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Td>
                );
              })}
            </Tr>
          ))}
        </TBody>
      </Table>

      <div className="flex flex-row items-center justify-center gap-4 py-3">
        <Button
          variant="secondary"
          onClick={firstPage}
          disabled={!tableInstance.getCanPreviousPage()}
        >
          First
        </Button>
        <Button
          variant="secondary"
          aria-label="Go to previous page"
          onClick={tableInstance.previousPage}
          disabled={!tableInstance.getCanPreviousPage()}
        >
          <ChevronUpIcon className="h-5 w-auto -rotate-90" />
        </Button>
        <span className="whitespace-nowrap text-sm font-bold">
          {tableInstance.getState().pagination.pageIndex + 1} / {tableInstance.getPageCount()}
        </span>
        <Button
          variant="secondary"
          aria-label="Go to next page"
          onClick={tableInstance.nextPage}
          disabled={!tableInstance.getCanNextPage()}
        >
          <ChevronUpIcon className="h-5 w-auto rotate-90" />
        </Button>
        <Button variant="secondary" onClick={lastPage} disabled={!tableInstance.getCanNextPage()}>
          Last
        </Button>
      </div>
    </>
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
          name: (
            <div>
              <div style={{ paddingBottom: 5, fontWeight: 'bold' }}>{node.organization.slug}</div>
              <pre title="id">{node.organization.id}</pre>
              <pre title="owner">{node.organization.owner.user.email}</pre>
            </div>
          ),
          members: (node.organization.members.nodes || []).map(v => v.user.email).join(', '),
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
    <DataWrapper query={query} organizationId={null}>
      {({ data }) => (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between rounded-md border border-gray-800 bg-gray-900/50 p-5">
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
