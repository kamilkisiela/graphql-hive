import 'twin.macro';
import React, { PropsWithChildren } from 'react';
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
} from '@chakra-ui/react';
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
import {
  VscChevronDown,
  VscChevronLeft,
  VscChevronRight,
  VscChevronUp,
  VscWarning,
} from 'react-icons/vsc';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { Scale, Section } from '@/components/common';
import { GraphQLHighlight } from '@/components/common/GraphQLSDLBlock';
import { env } from '@/env/frontend';
import { DateRangeInput, OperationsStatsDocument, OperationStatsFieldsFragment } from '@/graphql';
import { useDecimal, useFormattedDuration, useFormattedNumber } from '@/lib/hooks';
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
  document: string;
}

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
      justify={align === 'center' ? 'center' : align === 'left' ? 'start' : 'end'}
      tw="cursor-pointer"
    >
      <span>{children}</span>
      {isSorted ? isSortedDesc ? <VscChevronDown /> : <VscChevronUp /> : null}
    </Flex>
  );
};

const OperationRow: React.FC<{
  operation: Operation;
}> = ({ operation }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const linkRef = React.useRef<HTMLButtonElement | null>(null);
  const count = useFormattedNumber(operation.requests);
  const percentage = useDecimal(operation.percentage);
  const failureRate = useDecimal(operation.failureRate);
  const p90 = useFormattedDuration(operation.p90);
  const p95 = useFormattedDuration(operation.p95);
  const p99 = useFormattedDuration(operation.p99);

  return (
    <>
      <Tr>
        <Td tw="font-medium truncate">
          <div tw="flex flex-row">
            <Button
              as="a"
              href="#"
              size="sm"
              variant="link"
              // TODO: If you have an idea how to solve this TS issue, send a PR :)
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              ref={linkRef}
              onClick={e => {
                e.preventDefault();
                onOpen();
              }}
            >
              {operation.name}
            </Button>
            {operation.name === 'anonymous' && (
              <Tooltip
                placement="right"
                label="Anonymous operation detected. Naming your operations is a recommended practice"
              >
                <span tw="ml-1 text-yellow-500">
                  <VscWarning />
                </span>
              </Tooltip>
            )}
          </div>
        </Td>
        <Td textAlign="center">
          <span tw="text-xs">{operation.kind}</span>
        </Td>
        <Td textAlign="center">{p90}</Td>
        <Td textAlign="center">{p95}</Td>
        <Td textAlign="center">{p99}</Td>
        <Td textAlign="center">{failureRate}%</Td>
        <Td textAlign="center">{count}</Td>
        <Td textAlign="right">
          <div tw="flex flex-row justify-end">
            <div tw="mr-3">{percentage}%</div>
            <Scale value={operation.percentage} size={10} max={100} tw="justify-end" />
          </div>
        </Td>
      </Tr>
      <Drawer size="xl" isOpen={isOpen} placement="right" onClose={onClose} finalFocusRef={linkRef}>
        <DrawerOverlay />
        <DrawerContent bgColor="gray.900">
          <DrawerCloseButton />
          <DrawerHeader>
            {operation.kind} {operation.name}
          </DrawerHeader>

          <DrawerBody>
            <GraphQLHighlight tw="pt-6" light code={operation.document} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

const table = createTable().setRowType<Operation>();

const columns = [
  table.createDataColumn('name', {
    header: 'Operations',
  }),
  table.createDataColumn('kind', {
    header: 'Kind',
  }),
  table.createDataColumn('p90', {
    header: 'p90',
    footer: props => props.column.id,
  }),
  table.createDataColumn('p95', {
    header: 'p95',
    footer: props => props.column.id,
  }),
  table.createDataColumn('p99', {
    header: 'p99',
    footer: props => props.column.id,
  }),
  table.createDataColumn('failureRate', {
    header: 'Failure Rate',
    footer: props => props.column.id,
  }),
  table.createDataColumn('requests', {
    header: 'Requests',
    footer: props => props.column.id,
  }),
  table.createDataColumn('percentage', {
    header: 'Traffic',
    footer: props => props.column.id,
  }),
];

type SetPaginationFn = (updater: React.SetStateAction<PaginationState>) => void;

const OperationsTable: React.FC<{
  operations: Operation[];
  pagination: PaginationState;
  setPagination: SetPaginationFn;
  sorting: SortingState;
  setSorting: OnChangeFn<SortingState>;
  className?: string;
}> = ({ operations, sorting, setSorting, pagination, setPagination, className }) => {
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

  const firstPage = React.useCallback(() => {
    tableInstance.setPageIndex(0);
  }, [tableInstance]);
  const lastPage = React.useCallback(() => {
    tableInstance.setPageIndex(tableInstance.getPageCount() - 1);
  }, [tableInstance]);

  const debouncedSetPage = useDebouncedCallback((pageIndex: number) => {
    setPagination({ pageSize: tableInstance.getState().pagination.pageSize, pageIndex });
  }, 500);

  const headerGroup = tableInstance.getHeaderGroups()[0];

  function findColumn(key: string) {
    return headerGroup.headers[columns.findIndex(c => c.accessorKey === key)];
  }

  const p90Column = findColumn('p90');
  const p95Column = findColumn('p95');
  const p99Column = findColumn('p99');
  const failureRateColumn = findColumn('failureRate');
  const requestsColumn = findColumn('requests');
  const percentageColumn = findColumn('percentage');

  return (
    <div
      className={className}
      tw="transition-opacity ease-in-out duration-700 rounded-md p-5 ring-1 ring-gray-800 bg-gray-900/50"
    >
      <Section.Title>Operations</Section.Title>
      <Section.Subtitle>List of all operations with their statistics</Section.Subtitle>
      <Table tw="mt-6" variant="striped" colorScheme="gray" size="sm">
        <Thead>
          <Tr>
            <Th tw="truncate">Operation</Th>
            <Th textAlign="center">Kind</Th>
            <Th onClick={p90Column.column.getToggleSortingHandler()}>
              <Sortable
                align="center"
                isSorted={p90Column.column.getIsSorted() !== false}
                isSortedDesc={p90Column.column.getIsSorted() === 'desc'}
              >
                p90
              </Sortable>
            </Th>
            <Th onClick={p95Column.column.getToggleSortingHandler()}>
              <Sortable
                align="center"
                isSorted={p95Column.column.getIsSorted() !== false}
                isSortedDesc={p95Column.column.getIsSorted() === 'desc'}
              >
                p95
              </Sortable>
            </Th>
            <Th onClick={p99Column.column.getToggleSortingHandler()}>
              <Sortable
                align="center"
                isSorted={p99Column.column.getIsSorted() !== false}
                isSortedDesc={p99Column.column.getIsSorted() === 'desc'}
              >
                p99
              </Sortable>
            </Th>
            <Th onClick={failureRateColumn.column.getToggleSortingHandler()}>
              <Sortable
                align="center"
                isSorted={failureRateColumn.column.getIsSorted() !== false}
                isSortedDesc={failureRateColumn.column.getIsSorted() === 'desc'}
              >
                Failure Rate
              </Sortable>
            </Th>
            <Th onClick={requestsColumn.column.getToggleSortingHandler()}>
              <Sortable
                align="center"
                isSorted={requestsColumn.column.getIsSorted() !== false}
                isSortedDesc={requestsColumn.column.getIsSorted() === 'desc'}
              >
                Requests
              </Sortable>
            </Th>
            <Th onClick={percentageColumn.column.getToggleSortingHandler()}>
              <Sortable
                align="center"
                isSorted={percentageColumn.column.getIsSorted() !== false}
                isSortedDesc={percentageColumn.column.getIsSorted() === 'desc'}
              >
                Traffic
              </Sortable>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {tableInstance.getRowModel().rows.map(row => {
            if (!row.original) {
              return null;
            }
            return <OperationRow operation={row.original} key={row.original.id} />;
          })}
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
        <InputGroup variant="filled" tw="w-auto" size="sm">
          <InputLeftAddon>Go to</InputLeftAddon>
          <Input
            width="70px"
            type="number"
            placeholder="page"
            colorScheme="gray"
            defaultValue={tableInstance.getState().pagination.pageIndex + 1}
            onChange={e => {
              debouncedSetPage(e.target.valueAsNumber ? e.target.valueAsNumber - 1 : 0);
            }}
          />
        </InputGroup>
      </div>
    </div>
  );
};

const OperationsTableContainer: React.FC<{
  operations: readonly OperationStatsFieldsFragment[];
  operationsFilter: readonly string[];
  className?: string;
}> = ({ operations, operationsFilter, className }) => {
  const data = React.useMemo(() => {
    const records: Array<Operation> = [];
    for (const op of operations) {
      if (
        operationsFilter.length > 0 &&
        op.operationHash &&
        operationsFilter.includes(op.operationHash) === false
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
        failureRate: 1 - op.countOk / op.count,
        requests: op.count,
        percentage: op.percentage,
        document: op.document,
      });
    }

    return records;
  }, [operations, operationsFilter]);

  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const [sorting, setSorting] = React.useState<SortingState>([]);

  const safeSetPagination = React.useCallback<SetPaginationFn>(
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
    />
  );
};

export const OperationsList: React.FC<{
  className?: string;
  organization: string;
  project: string;
  target: string;
  period: DateRangeInput;
  operationsFilter: readonly string[];
}> = ({ className, organization, project, target, period, operationsFilter = [] }) => {
  const [query, refetch] = useQuery({
    query: OperationsStatsDocument,
    variables: {
      selector: {
        organization,
        project,
        target,
        period,
        operations: [],
      },
    },
  });
  const operations = query.data?.operationsStats?.operations?.nodes ?? [];

  return (
    <OperationsFallback
      isError={!!query.error}
      isFetching={query.fetching}
      refetch={() =>
        refetch({
          requestPolicy: 'cache-and-network',
        })
      }
    >
      <OperationsTableContainer
        operations={operations}
        operationsFilter={operationsFilter}
        className={className}
      />
    </OperationsFallback>
  );
};
