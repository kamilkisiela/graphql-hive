import { ReactElement, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { Scale, Section } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sortable, Table, TBody, Td, Th, THead, Tooltip, Tr } from '@/components/v2';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import { DateRangeInput } from '@/gql/graphql';
import { useDecimal, useFormattedDuration, useFormattedNumber } from '@/lib/hooks';
import { pick } from '@/lib/object';
import { ChevronUpIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Link } from '@tanstack/react-router';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { OperationsFallback } from './Fallback';

interface Operation {
  id: string;
  name: string;
  kind: string;
  p90: number;
  p95: number;
  p99: number;
  failureRate: number;
  requests: number;
  percentage: number;
  hash: string;
}

function OperationRow({
  operation,
  organizationSlug,
  projectSlug,
  targetSlug,
  selectedPeriod,
}: {
  operation: Operation;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  selectedPeriod: null | { to: string; from: string };
}): ReactElement {
  const count = useFormattedNumber(operation.requests);
  const percentage = useDecimal(operation.percentage);
  const failureRate = useDecimal(operation.failureRate);
  const p90 = useFormattedDuration(operation.p90);
  const p95 = useFormattedDuration(operation.p95);
  const p99 = useFormattedDuration(operation.p99);

  return (
    <>
      <Tr>
        <Td className="font-medium">
          <div className="flex items-center gap-2">
            <Button variant="orangeLink" className="h-auto p-0" asChild>
              <Link
                className="block max-w-[300px] truncate"
                to="/$organizationSlug/$projectSlug/$targetSlug/insights/$operationName/$operationHash"
                params={{
                  organizationSlug,
                  projectSlug,
                  targetSlug,
                  operationName: operation.name,
                  operationHash: operation.hash,
                }}
                search={searchParams => ({
                  ...pick(searchParams, ['clients']),
                  from: selectedPeriod?.from ? encodeURIComponent(selectedPeriod.from) : undefined,
                  to: selectedPeriod?.to ? encodeURIComponent(selectedPeriod.to) : undefined,
                })}
              >
                {operation.name}
              </Link>
            </Button>
            {operation.name === 'anonymous' && (
              <Tooltip.Provider delayDuration={200}>
                <Tooltip content="Anonymous operation detected. Naming your operations is a recommended practice">
                  <ExclamationTriangleIcon className="text-yellow-500" />
                </Tooltip>
              </Tooltip.Provider>
            )}
          </div>
        </Td>
        <Td align="center" className="text-xs">
          {operation.kind}
        </Td>
        <Td align="center">{p90}</Td>
        <Td align="center">{p95}</Td>
        <Td align="center">{p99}</Td>
        <Td align="center">{failureRate}%</Td>
        <Td align="center">{count}</Td>
        <Td align="right">{percentage}%</Td>
        <Td>
          <Scale value={operation.percentage} size={10} max={100} className="justify-end" />
        </Td>
      </Tr>
    </>
  );
}

const columnHelper = createColumnHelper<Operation>();

const columns = [
  columnHelper.accessor('name', {
    header: 'Operations',
    enableSorting: false,
    meta: {
      align: 'left',
    },
  }),
  columnHelper.accessor('kind', {
    header: 'Kind',
    enableSorting: false,
    meta: {
      align: 'center',
    },
  }),
  columnHelper.accessor('p90', {
    header: 'p90',
    meta: {
      align: 'center',
    },
  }),
  columnHelper.accessor('p95', {
    header: 'p95',
    meta: {
      align: 'center',
    },
  }),
  columnHelper.accessor('p99', {
    header: 'p99',
    meta: {
      align: 'center',
    },
  }),
  columnHelper.accessor('failureRate', {
    header: 'Failure Rate',
    meta: {
      align: 'center',
    },
  }),
  columnHelper.accessor('requests', {
    header: 'Requests',
    meta: {
      align: 'center',
    },
  }),
  columnHelper.accessor('percentage', {
    header: 'Traffic',
    meta: {
      align: 'right',
    },
  }),
];

type SetPaginationFn = (updater: SetStateAction<PaginationState>) => void;

function OperationsTable({
  operations,
  sorting,
  setSorting,
  pagination,
  setPagination,
  className,
  organizationSlug,
  projectSlug,
  targetSlug,
  selectedPeriod,
}: {
  operations: Operation[];
  pagination: PaginationState;
  setPagination: SetPaginationFn;
  sorting: SortingState;
  setSorting: OnChangeFn<SortingState>;
  className?: string;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  clients: readonly { name: string }[] | null;
  clientFilter: string | null;
  setClientFilter: (filter: string) => void;
  selectedPeriod: { from: string; to: string } | null;
}): ReactElement {
  const tableInstance = useReactTable({
    columns,
    data: operations,
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

  const firstPage = useCallback(() => {
    tableInstance.setPageIndex(0);
  }, [tableInstance]);
  const lastPage = useCallback(() => {
    tableInstance.setPageIndex(tableInstance.getPageCount() - 1);
  }, [tableInstance]);

  const debouncedSetPage = useDebouncedCallback((pageIndex: number) => {
    setPagination({ pageSize: tableInstance.getState().pagination.pageSize, pageIndex });
  }, 500);

  const { headers } = tableInstance.getHeaderGroups()[0];

  return (
    <div className={clsx('rounded-md border border-gray-800 bg-gray-900/50 p-5', className)}>
      <Section.Title>Operations</Section.Title>
      <Section.Subtitle>List of all operations with their statistics</Section.Subtitle>

      <Table>
        <THead>
          <Tooltip.Provider>
            {headers.map(header => {
              const canSort = header.column.getCanSort();
              const align: 'center' | 'left' | 'right' =
                (header.column.columnDef.meta as any)?.align || 'left';
              const name = flexRender(header.column.columnDef.header, header.getContext());
              return (
                <Th key={header.id} className="text-sm font-semibold" align={align}>
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
          {tableInstance
            .getRowModel()
            .rows.map(
              row =>
                row.original && (
                  <OperationRow
                    operation={row.original}
                    key={row.original.id}
                    organizationSlug={organizationSlug}
                    projectSlug={projectSlug}
                    targetSlug={targetSlug}
                    selectedPeriod={selectedPeriod}
                  />
                ),
            )}
        </TBody>
      </Table>
      <div className="mt-6 flex items-center gap-2">
        <Button
          onClick={firstPage}
          variant="outline"
          disabled={!tableInstance.getCanPreviousPage()}
        >
          First
        </Button>
        <Button
          aria-label="Go to previous page"
          variant="outline"
          onClick={tableInstance.previousPage}
          disabled={!tableInstance.getCanPreviousPage()}
        >
          <ChevronUpIcon className="h-5 w-auto -rotate-90" />
        </Button>
        <span className="whitespace-nowrap text-sm font-bold">
          {tableInstance.getState().pagination.pageIndex + 1} / {tableInstance.getPageCount()}
        </span>
        <Button
          aria-label="Go to next page"
          variant="outline"
          onClick={tableInstance.nextPage}
          disabled={!tableInstance.getCanNextPage()}
        >
          <ChevronUpIcon className="h-5 w-auto rotate-90" />
        </Button>
        <Button variant="outline" onClick={lastPage} disabled={!tableInstance.getCanNextPage()}>
          Last
        </Button>
        <div className="ml-6">Go to:</div>
        <Input
          id="page"
          className="w-16"
          type="number"
          defaultValue={tableInstance.getState().pagination.pageIndex + 1}
          onChange={e => {
            debouncedSetPage(e.target.valueAsNumber ? e.target.valueAsNumber - 1 : 0);
          }}
        />
      </div>
    </div>
  );
}

const OperationsTableContainer_OperationsStatsFragment = graphql(`
  fragment OperationsTableContainer_OperationsStatsFragment on OperationsStats {
    clients {
      nodes {
        name
      }
    }
    operations {
      nodes {
        id
        name
        operationHash
        kind
        duration {
          p90
          p95
          p99
        }
        countOk
        count
        percentage
      }
    }
  }
`);

function OperationsTableContainer({
  operationsFilter,
  organizationSlug,
  projectSlug,
  targetSlug,
  clientFilter,
  setClientFilter,
  className,
  selectedPeriod,
  ...props
}: {
  operationStats: FragmentType<typeof OperationsTableContainer_OperationsStatsFragment> | null;
  operationsFilter: readonly string[];
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  selectedPeriod: { from: string; to: string } | null;
  clientFilter: string | null;
  setClientFilter: (client: string) => void;
  className?: string;
}): ReactElement {
  const operationStats = useFragment(
    OperationsTableContainer_OperationsStatsFragment,
    props.operationStats,
  );
  const data = useMemo(() => {
    const records: Operation[] = [];
    if (operationStats) {
      for (const op of operationStats.operations.nodes) {
        if (
          operationsFilter.length > 0 &&
          op.operationHash &&
          !operationsFilter.includes(op.operationHash)
        ) {
          continue;
        }
        records.push({
          id: op.id,
          name: op.name,
          kind: op.kind,
          p90: op.duration.p90,
          p95: op.duration.p95,
          p99: op.duration.p99,
          failureRate: (1 - op.countOk / op.count) * 100,
          requests: op.count,
          percentage: op.percentage,
          hash: op.operationHash!,
        });
      }
    }

    return records;
  }, [operationStats?.operations.nodes, operationsFilter]);

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [sorting, setSorting] = useState<SortingState>([]);

  const safeSetPagination = useCallback<SetPaginationFn>(
    state => {
      const handleValue = (state: PaginationState) => {
        const maxPageIndex = Math.ceil(data.length / state.pageSize) - 1;
        if (state.pageIndex < 0) {
          return { ...state, pageIndex: 0 };
        }
        if (state.pageIndex > maxPageIndex) {
          return { ...state, pageIndex: maxPageIndex };
        }
        return state;
      };
      setPagination(
        typeof state === 'function' ? value => handleValue(state(value)) : handleValue(state),
      );
    },
    [pagination, setPagination, data],
  );

  return (
    <OperationsTable
      operations={data}
      className={className}
      pagination={pagination}
      setPagination={safeSetPagination}
      sorting={sorting}
      setSorting={setSorting}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
      targetSlug={targetSlug}
      clients={operationStats?.clients.nodes ?? null}
      clientFilter={clientFilter}
      setClientFilter={setClientFilter}
      selectedPeriod={selectedPeriod}
    />
  );
}

const OperationsList_OperationsStatsQuery = graphql(`
  query OperationsList_OperationsStats($selector: OperationsStatsSelectorInput!) {
    operationsStats(selector: $selector) {
      clients {
        nodes {
          __typename
        }
      }
      operations {
        nodes {
          id
          __typename
        }
      }
      ...OperationsTableContainer_OperationsStatsFragment
    }
  }
`);

export function OperationsList({
  className,
  organizationSlug,
  projectSlug,
  targetSlug,
  period,
  operationsFilter = [],
  clientNamesFilter = [],
  selectedPeriod,
}: {
  className?: string;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  period: DateRangeInput;
  operationsFilter: readonly string[];
  clientNamesFilter: string[];
  selectedPeriod: null | { to: string; from: string };
}): ReactElement {
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [query, refetchQuery] = useQuery({
    query: OperationsList_OperationsStatsQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
        period,
        operations: [],
        clientNames: clientNamesFilter,
      },
    },
  });

  const refetch = () => refetchQuery({ requestPolicy: 'cache-and-network' });

  useEffect(() => {
    if (!query.fetching) {
      refetch();
    }
  }, [period]);

  return (
    <OperationsFallback
      state={query.fetching ? 'fetching' : query.error ? 'error' : 'success'}
      refetch={() => refetch()}
    >
      <OperationsTableContainer
        operationStats={query.data?.operationsStats ?? null}
        operationsFilter={operationsFilter}
        className={className}
        setClientFilter={setClientFilter}
        clientFilter={clientFilter}
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
        targetSlug={targetSlug}
        selectedPeriod={selectedPeriod}
      />
    </OperationsFallback>
  );
}
