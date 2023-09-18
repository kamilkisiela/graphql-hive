import { ReactElement, SetStateAction, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { Scale, Section } from '@/components/common';
import { Button, Input, Sortable, Table, TBody, Td, Th, THead, Tooltip, Tr } from '@/components/v2';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import { DateRangeInput } from '@/graphql';
import { useDecimal, useFormattedDuration, useFormattedNumber } from '@/lib/hooks';
import { ChevronUpIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import {
  createTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  PaginationState,
  SortingState,
  useTableInstance,
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
  organization,
  project,
  target,
  selectedPeriod,
}: {
  operation: Operation;
  organization: string;
  project: string;
  target: string;
  selectedPeriod: string;
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
        <Td className="font-medium truncate">
          <div className="flex gap-2 items-center">
            <Link
              href={{
                pathname:
                  '/[organizationId]/[projectId]/[targetId]/operations/[operationName]/[operationHash]',
                query: {
                  organizationId: organization,
                  projectId: project,
                  targetId: target,
                  operationName: operation.name,
                  operationHash: operation.hash,
                  period: selectedPeriod,
                },
              }}
              passHref
            >
              <Button variant="link" as="a">
                {operation.name}
              </Button>
            </Link>
            {operation.name === 'anonymous' && (
              <Tooltip.Provider delayDuration={200}>
                <Tooltip content="Anonymous operation detected. Naming your operations is a recommended practice">
                  <ExclamationTriangleIcon className="text-yellow-500" />
                </Tooltip>
              </Tooltip.Provider>
            )}
          </div>
        </Td>
        <Td align="center">{operation.kind}</Td>
        <Td align="center">{p90}</Td>
        <Td align="center">{p95}</Td>
        <Td align="center">{p99}</Td>
        <Td align="center">{failureRate}%</Td>
        <Td align="center">{count}</Td>
        <Td align="right" width="1">
          {percentage}%
        </Td>
        <Td width="1">
          <Scale value={operation.percentage} size={10} max={100} className="justify-end" />
        </Td>
      </Tr>
    </>
  );
}

const table = createTable().setRowType<Operation>();

const columns = [
  table.createDataColumn('name', {
    header: 'Operations',
    enableSorting: false,
  }),
  table.createDataColumn('kind', {
    header: 'Kind',
    enableSorting: false,
  }),
  table.createDataColumn('p90', {
    header: 'p90',
  }),
  table.createDataColumn('p95', {
    header: 'p95',
  }),
  table.createDataColumn('p99', {
    header: 'p99',
  }),
  table.createDataColumn('failureRate', {
    header: 'Failure Rate',
  }),
  table.createDataColumn('requests', {
    header: 'Requests',
  }),
  table.createDataColumn('percentage', {
    header: 'Traffic',
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
  organization,
  project,
  target,
  selectedPeriod,
}: {
  operations: Operation[];
  pagination: PaginationState;
  setPagination: SetPaginationFn;
  sorting: SortingState;
  setSorting: OnChangeFn<SortingState>;
  className?: string;
  organization: string;
  project: string;
  target: string;
  clients: readonly { name: string }[] | null;
  clientFilter: string | null;
  setClientFilter: (filter: string) => void;
  selectedPeriod: string;
}): ReactElement {
  const tableInstance = useTableInstance(table, {
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
    <div className={clsx('rounded-md p-5 border border-gray-800 bg-gray-900/50', className)}>
      <Section.Title>Operations</Section.Title>
      <Section.Subtitle>List of all operations with their statistics</Section.Subtitle>

      <Table>
        <THead>
          <Tooltip.Provider>
            {headers.map(header => {
              const canSort = header.column.getCanSort();
              const name = header.renderHeader();
              return (
                <Th key={header.id}>
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
                    organization={organization}
                    project={project}
                    target={target}
                    selectedPeriod={selectedPeriod}
                  />
                ),
            )}
        </TBody>
      </Table>
      <div className="flex items-center gap-2 mt-6">
        <Button onClick={firstPage} disabled={!tableInstance.getCanPreviousPage()}>
          First
        </Button>
        <Button
          aria-label="Go to previous page"
          onClick={tableInstance.previousPage}
          disabled={!tableInstance.getCanPreviousPage()}
        >
          <ChevronUpIcon className="-rotate-90 h-5 w-auto" />
        </Button>
        <span className="font-bold whitespace-nowrap text-sm">
          {tableInstance.getState().pagination.pageIndex + 1} / {tableInstance.getPageCount()}
        </span>
        <Button
          aria-label="Go to next page"
          onClick={tableInstance.nextPage}
          disabled={!tableInstance.getCanNextPage()}
        >
          <ChevronUpIcon className="rotate-90 h-5 w-auto" />
        </Button>
        <Button onClick={lastPage} disabled={!tableInstance.getCanNextPage()}>
          Last
        </Button>
        <Input
          prefix={
            <label htmlFor="page" className="shrink-0">
              Go to:
            </label>
          }
          id="page"
          size="medium"
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
  organization,
  project,
  target,
  clientFilter,
  setClientFilter,
  className,
  selectedPeriod,
  ...props
}: {
  operationStats: FragmentType<typeof OperationsTableContainer_OperationsStatsFragment> | null;
  operationsFilter: readonly string[];
  organization: string;
  project: string;
  target: string;
  selectedPeriod: string;
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
      organization={organization}
      project={project}
      target={target}
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
          __typename
        }
      }
      ...OperationsTableContainer_OperationsStatsFragment
    }
  }
`);

export function OperationsList({
  className,
  organization,
  project,
  target,
  period,
  operationsFilter = [],
  clientNamesFilter = [],
  selectedPeriod,
}: {
  className?: string;
  organization: string;
  project: string;
  target: string;
  period: DateRangeInput;
  operationsFilter: readonly string[];
  clientNamesFilter: string[];
  selectedPeriod: string;
}): ReactElement {
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [query, refetch] = useQuery({
    query: OperationsList_OperationsStatsQuery,
    variables: {
      selector: {
        organization,
        project,
        target,
        period,
        operations: [],
        clientNames: clientNamesFilter,
      },
    },
  });

  return (
    <OperationsFallback
      isError={!!query.error}
      isFetching={query.fetching}
      refetch={() => refetch({ requestPolicy: 'cache-and-network' })}
    >
      <OperationsTableContainer
        operationStats={query.data?.operationsStats ?? null}
        operationsFilter={operationsFilter}
        className={className}
        setClientFilter={setClientFilter}
        clientFilter={clientFilter}
        organization={organization}
        project={project}
        target={target}
        selectedPeriod={selectedPeriod}
      />
    </OperationsFallback>
  );
}
