import React from 'react';
import 'twin.macro';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { useTable, useSortBy, usePagination } from 'react-table';
import {
  VscChevronUp,
  VscChevronDown,
  VscChevronLeft,
  VscChevronRight,
  VscWarning,
} from 'react-icons/vsc';
import {
  Input,
  InputGroup,
  InputLeftAddon,
  Button,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Tooltip,
  useDisclosure,
  Flex,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';

import { Scale, Section } from '@/components/common';
import { GraphQLHighlight } from '@/components/common/GraphQLSDLBlock';
import {
  DateRangeInput,
  OperationsStatsDocument,
  OperationStatsFieldsFragment,
} from '@/graphql';

import { useFormattedNumber } from '@/lib/hooks/use-formatted-number';
import { useDecimal } from '@/lib/hooks/use-decimal';
import { useFormattedDuration } from '@/lib/hooks/use-formatted-duration';

interface Operation {
  id: string;
  name: string;
  kind: string;
  hash: string;
  p90: number;
  p95: number;
  p99: number;
  failureRate: number;
  requests: number;
  percentage: number;
  document: string;
}

const Sortable: React.FC<{
  align?: 'center' | 'right' | 'left';
  isSortedDesc?: boolean;
  isSorted?: boolean;
}> = ({ children, isSorted, isSortedDesc, align = 'left' }) => {
  return (
    <Flex
      direction="row"
      align="center"
      justify={
        align === 'center' ? 'center' : align === 'left' ? 'start' : 'end'
      }
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
  const linkRef = React.useRef();
  const count = useFormattedNumber(operation.requests);
  const percentage = useDecimal(operation.percentage);
  const failureRate = useDecimal(operation.failureRate);
  const p90 = useFormattedDuration(operation.p90);
  const p95 = useFormattedDuration(operation.p95);
  const p99 = useFormattedDuration(operation.p99);
  const operationHash = operation.hash;

  return (
    <>
      <Tr>
        <Td tw="font-medium">
          <div tw="flex flex-row">
            <Button
              as="a"
              href="#"
              size="sm"
              variant="link"
              ref={linkRef}
              onClick={(e) => {
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
        <Td>
          <span tw="text-xs text-gray-500">{operationHash}</span>
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
            <Scale
              value={operation.percentage}
              size={10}
              max={100}
              tw="justify-end"
            />
          </div>
        </Td>
      </Tr>
      <Drawer
        size="xl"
        isOpen={isOpen}
        placement="right"
        onClose={onClose}
        finalFocusRef={linkRef}
      >
        <DrawerOverlay />
        <DrawerContent>
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

const OperationsTable: React.FC<{
  operations: readonly Operation[];
  fetching?: boolean;
  className?: string;
}> = ({ operations, fetching, className }) => {
  const columns = React.useMemo(
    () => [
      {
        Header: 'Operation',
        accessor: 'name',
      },
      {
        Header: 'Hash',
        accessor: 'hash',
      },
      {
        Header: 'Kind',
        accessor: 'kind',
      },
      {
        Header: 'p90',
        accessor: 'p90',
      },
      {
        Header: 'p95',
        accessor: 'p95',
      },
      {
        Header: 'p99',
        accessor: 'p99',
      },
      {
        Header: 'Failure Rate',
        accessor: 'failureRate',
      },
      {
        Header: 'Requests',
        accessor: 'requests',
      },
      {
        Header: 'Traffic',
        accessor: 'percentage',
      },
    ],
    []
  );
  const {
    getTableProps,
    headerGroups,
    prepareRow,
    page: rows,
    previousPage,
    gotoPage,
    nextPage,
    canPreviousPage,
    canNextPage,
    pageCount,
    pageOptions,
    state: { pageIndex },
  } = useTable(
    {
      columns,
      data: operations,
      pageCount: Math.ceil(operations.length / 20),
      initialState: {
        pageSize: 20,
      },
    },
    useSortBy,
    usePagination
  );

  const firstPage = React.useCallback(() => {
    gotoPage(0);
  }, [gotoPage]);
  const lastPage = React.useCallback(() => {
    gotoPage(pageCount - 1);
  }, [gotoPage, pageCount]);

  const debouncedSetPage = useDebouncedCallback(gotoPage, 500);

  const headerGroup = headerGroups[0];

  function findColumn(key: string) {
    return headerGroup.headers[columns.findIndex((c) => c.accessor === key)];
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
      tw="transition-opacity ease-in-out duration-700"
      style={{
        opacity: fetching ? 0.5 : 1,
      }}
    >
      <Section.Title>Operations</Section.Title>
      <Section.Subtitle>
        List of all operations with their statistics
      </Section.Subtitle>
      <Table
        tw="mt-6"
        variant="striped"
        colorScheme="gray"
        size="sm"
        {...getTableProps()}
      >
        <Thead>
          <Tr {...headerGroup.getHeaderGroupProps()}>
            <Th>Operation</Th>
            <Th>Hash</Th>
            <Th textAlign="center">Kind</Th>
            <Th {...p90Column.getHeaderProps(p90Column.getSortByToggleProps())}>
              <Sortable
                align="center"
                isSorted={p90Column.isSorted}
                isSortedDesc={p90Column.isSortedDesc}
              >
                p90
              </Sortable>
            </Th>
            <Th {...p95Column.getHeaderProps(p95Column.getSortByToggleProps())}>
              <Sortable
                align="center"
                isSorted={p95Column.isSorted}
                isSortedDesc={p95Column.isSortedDesc}
              >
                p95
              </Sortable>
            </Th>
            <Th {...p99Column.getHeaderProps(p99Column.getSortByToggleProps())}>
              <Sortable
                align="center"
                isSorted={p99Column.isSorted}
                isSortedDesc={p99Column.isSortedDesc}
              >
                p99
              </Sortable>
            </Th>
            <Th
              {...failureRateColumn.getHeaderProps(
                failureRateColumn.getSortByToggleProps()
              )}
            >
              <Sortable
                align="center"
                isSorted={failureRateColumn.isSorted}
                isSortedDesc={failureRateColumn.isSortedDesc}
              >
                Failure Rate
              </Sortable>
            </Th>
            <Th
              {...requestsColumn.getHeaderProps(
                requestsColumn.getSortByToggleProps()
              )}
            >
              <Sortable
                align="center"
                isSorted={requestsColumn.isSorted}
                isSortedDesc={requestsColumn.isSortedDesc}
              >
                Requests
              </Sortable>
            </Th>
            <Th
              {...percentageColumn.getHeaderProps(
                percentageColumn.getSortByToggleProps()
              )}
            >
              <Sortable
                align="center"
                isSorted={percentageColumn.isSorted}
                isSortedDesc={percentageColumn.isSortedDesc}
              >
                Traffic
              </Sortable>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => {
            prepareRow(row);
            return (
              <OperationRow operation={row.original} key={row.original.id} />
            );
          })}
        </Tbody>
      </Table>
      <div tw="py-3 flex flex-row items-center justify-center space-x-2">
        <Button
          size="sm"
          variant="ghost"
          colorScheme="gray"
          onClick={firstPage}
          disabled={!canPreviousPage}
        >
          First
        </Button>
        <IconButton
          size="sm"
          variant="ghost"
          colorScheme="gray"
          aria-label="Go to previous page"
          onClick={previousPage}
          disabled={!canPreviousPage}
          icon={<VscChevronLeft />}
        />
        <span tw="font-bold whitespace-nowrap text-sm">
          {pageIndex + 1} / {pageOptions.length}
        </span>
        <IconButton
          size="sm"
          variant="ghost"
          colorScheme="gray"
          aria-label="Go to next page"
          onClick={nextPage}
          disabled={!canNextPage}
          icon={<VscChevronRight />}
        />
        <Button
          size="sm"
          variant="ghost"
          colorScheme="gray"
          onClick={lastPage}
          disabled={!canNextPage}
        >
          Last
        </Button>
        <InputGroup variant="filled" tw="w-auto" size="sm">
          <InputLeftAddon children="Go to" />
          <Input
            width="70px"
            type="number"
            placeholder="page"
            colorScheme="gray"
            defaultValue={pageIndex + 1}
            onChange={(e) => {
              debouncedSetPage(
                e.target.valueAsNumber ? e.target.valueAsNumber - 1 : 0
              );
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
  fetching?: boolean;
  className?: string;
}> = ({ operations, operationsFilter, className, fetching }) => {
  const data = React.useMemo(
    () =>
      operations
        .filter((op) =>
          operationsFilter.length
            ? operationsFilter.includes(op.operationHash)
            : true
        )
        .map((op) => ({
          id: op.id,
          name: op.name,
          kind: op.kind,
          hash: op.operationHash,
          p90: op.duration.p90,
          p95: op.duration.p95,
          p99: op.duration.p99,
          failureRate: 1 - op.countOk / op.count,
          requests: op.count,
          percentage: op.percentage,
          document: op.document,
        })),
    [operations, operationsFilter]
  );

  return (
    <OperationsTable
      fetching={fetching}
      operations={data}
      className={className}
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
}> = ({
  className,
  organization,
  project,
  target,
  period,
  operationsFilter = [],
}) => {
  const [query] = useQuery({
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
    <OperationsTableContainer
      fetching={query.fetching}
      operations={operations}
      operationsFilter={operationsFilter}
      className={className}
    />
  );
};
