import 'twin.macro';
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
} from '@chakra-ui/react';
import ReactECharts from 'echarts-for-react';
import { AutoSizer } from 'react-virtualized';
import { useTable, useSortBy } from 'react-table';
import React from 'react';
import { DocumentType, gql, useQuery } from 'urql';
import { VscChevronUp, VscChevronDown } from 'react-icons/vsc';
import { DataWrapper } from '@/components/common/DataWrapper';
import { theme } from '@/lib/charts';

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
  operations: Array<
    DocumentType<typeof CollectedOperationsOverTime_OperationFragment>
  >;
}> = ({ last, operations }) => {
  const period = {
    from: new Date(Date.now() - (last === 0 ? 30 : last) * 24 * 60 * 60 * 1000),
    to: new Date(),
  };

  const data = React.useMemo(() => {
    return operations.map<[string, number]>((node) => [node.date, node.count]);
  }, []);

  return (
    <AutoSizer disableHeight>
      {(size) => (
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
      justifyContent={
        align === 'center'
          ? 'center'
          : align === 'left'
          ? 'flex-start'
          : 'flex-end'
      }
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
  row: DocumentType<
    typeof AdminStatsQuery
  >['admin']['stats']['organizations'][0],
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
      {
        Header: 'Organization',
        accessor: 'name',
      },
      {
        Header: 'Type',
        accessor: 'type',
      },
      {
        Header: 'Members',
        accessor: 'users',
        isNumeric: true,
        align: 'right',
      },
      {
        Header: 'Projects',
        accessor: 'projects',
        isNumeric: true,
        align: 'right',
      },
      {
        Header: 'Targets',
        accessor: 'targets',
        isNumeric: true,
        align: 'right',
      },
      {
        Header: 'Schema pushes',
        accessor: 'versions',
        isNumeric: true,
        align: 'right',
      },
      {
        Header: 'Persisted Ops',
        accessor: 'persistedOperations',
        isNumeric: true,
        align: 'right',
      },
      {
        Header: 'Collected Ops',
        accessor: 'operations',
        isNumeric: true,
        align: 'right',
      },
    ],
    []
  );

  const data = React.useMemo(() => {
    return (query.data?.admin?.stats.organizations ?? [])
      .filter((node) => filterStats(node, filters))
      .map((node) => ({
        name: `${node.organization.name} (id: ${node.organization.cleanId}, owner: ${node.organization.owner.user.email})`,
        type: node.organization.type,
        users: node.users,
        projects: node.projects,
        targets: node.targets,
        versions: node.versions,
        persistedOperations: node.persistedOperations,
        operations: node.operations,
      }));
  }, [query.data, filters]);

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, rows } =
    useTable(
      {
        columns,
        data,
      },
      useSortBy
    );

  const overall = React.useMemo(() => {
    return {
      users: data.reduce(
        (total, node) => (node.type === 'PERSONAL' ? total + 1 : total),
        0
      ),
      organizations: data.length,
      projects: sumByKey(data, 'projects'),
      targets: sumByKey(data, 'targets'),
      versions: sumByKey(data, 'versions'),
      persistedOperations: sumByKey(data, 'persistedOperations'),
      operations: sumByKey(data, 'operations'),
    };
  }, [data]);

  const headerGroup = headerGroups[0];

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
            <OverallStat
              label="Peristed Ops"
              value={overall.persistedOperations}
            />
            <OverallStat label="Collected Ops" value={overall.operations} />
          </StatGroup>
          <CollectedOperationsOverTime
            last={last}
            operations={query.data?.admin.stats.general.operationsOverTime}
          />
          <Table variant="striped" size="sm" {...getTableProps()}>
            <Thead>
              <Tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column) => {
                  return (
                    <Th
                      {...column.getHeaderProps(column.getSortByToggleProps())}
                      align={column.align}
                    >
                      <Sortable
                        align={column.align}
                        isSorted={column.isSorted}
                        isSortedDesc={column.isSortedDesc}
                      >
                        {column.render('Header')}
                      </Sortable>
                    </Th>
                  );
                })}
              </Tr>
            </Thead>
            <Tbody {...getTableBodyProps()}>
              {rows.map((row) => {
                prepareRow(row);
                return (
                  <Tr {...row.getRowProps()}>
                    {row.cells.map((cell) => {
                      return (
                        <Td
                          {...cell.getCellProps()}
                          isNumeric={cell.column.isNumeric}
                          align={cell.column.align}
                        >
                          {cell.column.isNumeric
                            ? formatNumber(cell.value)
                            : cell.render('Cell')}
                        </Td>
                      );
                    })}
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      )}
    </DataWrapper>
  );
};
