import { ChangeEvent, ComponentType, ReactElement, useCallback, useEffect, useState } from 'react';
import { FilterIcon } from 'lucide-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox, Input } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { DateRangeInput } from '@/gql/graphql';
import { useFormattedNumber, useToggle } from '@/lib/hooks';

const OperationsFilter_OperationStatsValuesConnectionFragment = graphql(`
  fragment OperationsFilter_OperationStatsValuesConnectionFragment on OperationStatsValuesConnection {
    nodes {
      id
      operationHash
      name
      ...OperationRow_OperationStatsValuesFragment
    }
  }
`);

function OperationsFilter({
  onClose,
  isOpen,
  onFilter,
  operationStatsConnection,
  selected,
}: {
  onClose(): void;
  onFilter(keys: string[]): void;
  isOpen: boolean;
  operationStatsConnection: FragmentType<
    typeof OperationsFilter_OperationStatsValuesConnectionFragment
  >;
  selected?: string[];
}): ReactElement {
  const operations = useFragment(
    OperationsFilter_OperationStatsValuesConnectionFragment,
    operationStatsConnection,
  );

  function getOperationHashes() {
    const items: string[] = [];
    for (const op of operations.nodes) {
      if (op.operationHash) {
        items.push(op.operationHash);
      }
    }
    return items;
  }

  const [selectedItems, setSelectedItems] = useState<string[]>(() =>
    getOperationHashes().filter(hash => selected?.includes(hash) ?? true),
  );

  const onSelect = useCallback(
    (operationHash: string, selected: boolean) => {
      const itemAt = selectedItems.findIndex(hash => hash === operationHash);
      const exists = itemAt > -1;

      if (selected && !exists) {
        setSelectedItems([...selectedItems, operationHash]);
      } else if (!selected && exists) {
        setSelectedItems(selectedItems.filter(hash => hash !== operationHash));
      }
    },
    [selectedItems, setSelectedItems],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedFilter = useDebouncedCallback((value: string) => {
    setVisibleOperations(
      operations.nodes.filter(op =>
        op.name.toLocaleLowerCase().includes(value.toLocaleLowerCase()),
      ),
    );
  }, 500);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;

      setSearchTerm(value);
      debouncedFilter(value);
    },
    [setSearchTerm, debouncedFilter],
  );

  const [visibleOperations, setVisibleOperations] = useState(operations.nodes);

  const selectAll = useCallback(() => {
    setSelectedItems(getOperationHashes());
  }, [operations]);
  const selectNone = useCallback(() => {
    setSelectedItems([]);
  }, [setSelectedItems]);

  const renderRow = useCallback<ComponentType<ListChildComponentProps>>(
    ({ index, style }) => {
      const operation = visibleOperations[index];

      return (
        <OperationRow
          style={style}
          key={operation.id}
          operationStats={operation}
          selected={selectedItems.includes(operation.operationHash || '')}
          onSelect={onSelect}
        />
      );
    },
    [visibleOperations, selectedItems, onSelect],
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Filter by operation</SheetTitle>
        </SheetHeader>

        <div className="flex h-full flex-col space-y-3 py-4">
          <Input
            size="medium"
            placeholder="Search for operation..."
            onChange={onChange}
            value={searchTerm}
            onClear={() => {
              setSearchTerm('');
              setVisibleOperations(operations.nodes);
            }}
          />
          <div className="flex w-full items-center gap-2">
            <Button variant="link" onClick={selectAll}>
              All
            </Button>
            <Button variant="link" onClick={selectNone}>
              None
            </Button>
            <Button className="ml-auto" onClick={selectAll}>
              Reset
            </Button>
            <Button
              variant="primary"
              disabled={selectedItems.length === 0}
              onClick={() => {
                onFilter(selectedItems);
                onClose();
              }}
            >
              Save
            </Button>
          </div>
          <div className="grow pl-1">
            <AutoSizer>
              {({ height, width }) =>
                !height || !width ? (
                  <></>
                ) : (
                  <FixedSizeList
                    height={height}
                    width={width}
                    itemCount={visibleOperations.length}
                    itemSize={24}
                    overscanCount={5}
                  >
                    {renderRow}
                  </FixedSizeList>
                )
              }
            </AutoSizer>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const OperationsFilterContainer_OperationStatsQuery = graphql(`
  query OperationsFilterContainer_OperationStatsQuery($selector: OperationsStatsSelectorInput!) {
    operationsStats(selector: $selector) {
      operations {
        ...OperationsFilter_OperationStatsValuesConnectionFragment
        total
      }
    }
  }
`);

function OperationsFilterContainer({
  period,
  isOpen,
  onClose,
  onFilter,
  selected,
  organizationSlug,
  projectSlug,
  targetSlug,
}: {
  onFilter(keys: string[]): void;
  onClose(): void;
  isOpen: boolean;
  period: DateRangeInput;
  selected?: string[];
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement | null {
  const [query, refresh] = useQuery({
    query: OperationsFilterContainer_OperationStatsQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
        period,
        operations: [],
      },
    },
  });

  useEffect(() => {
    if (!query.fetching) {
      refresh({ requestPolicy: 'network-only' });
    }
  }, [period]);

  if (!isOpen) {
    return null;
  }

  if (query.fetching || query.error || !query.data) {
    return <Spinner />;
  }

  return (
    <OperationsFilter
      operationStatsConnection={query.data.operationsStats?.operations}
      selected={selected}
      isOpen={isOpen}
      onClose={onClose}
      onFilter={hashes => {
        onFilter(hashes.length === query.data?.operationsStats.operations.total ? [] : hashes);
      }}
    />
  );
}

const OperationRow_OperationStatsValuesFragment = graphql(`
  fragment OperationRow_OperationStatsValuesFragment on OperationStatsValues {
    id
    name
    operationHash
    count
  }
`);

function OperationRow({
  operationStats,
  selected,
  onSelect,
  style,
}: {
  operationStats: FragmentType<typeof OperationRow_OperationStatsValuesFragment>;
  selected: boolean;
  onSelect(id: string, selected: boolean): void;
  style: any;
}): ReactElement {
  const operation = useFragment(OperationRow_OperationStatsValuesFragment, operationStats);
  const requests = useFormattedNumber(operation.count);
  const hash = operation.operationHash || '';
  const change = useCallback(() => {
    if (hash) {
      onSelect(hash, !selected);
    }
  }, [onSelect, hash, selected]);

  return (
    <div style={style} className="flex items-center gap-4 truncate">
      <Checkbox checked={selected} onCheckedChange={change} id={hash} />
      <label
        htmlFor={hash}
        className="flex w-full cursor-pointer items-center justify-between gap-4 overflow-hidden"
      >
        <span className="grow overflow-hidden text-ellipsis">{operation.name}</span>
        <div className="shrink-0 text-right text-gray-500">{requests}</div>
      </label>
    </div>
  );
}

export function OperationsFilterTrigger({
  period,
  onFilter,
  selected,
  organizationSlug,
  projectSlug,
  targetSlug,
}: {
  period: DateRangeInput;
  onFilter(keys: string[]): void;
  selected?: string[];
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement {
  const [isOpen, toggle] = useToggle();

  return (
    <>
      <Button variant="outline" className="bg-accent" onClick={toggle}>
        <span>Operations ({selected?.length || 'all'})</span>
        <FilterIcon className="ml-2 size-4" />
      </Button>
      <OperationsFilterContainer
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
        targetSlug={targetSlug}
        isOpen={isOpen}
        onClose={toggle}
        period={period}
        selected={selected}
        onFilter={onFilter}
      />
    </>
  );
}

const ClientRow_ClientStatsValuesFragment = graphql(`
  fragment ClientRow_ClientStatsValuesFragment on ClientStatsValues {
    name
    count
  }
`);

function ClientRow({
  selected,
  onSelect,
  style,
  ...props
}: {
  client: FragmentType<typeof ClientRow_ClientStatsValuesFragment>;
  selected: boolean;
  onSelect(id: string, selected: boolean): void;
  style: any;
}): ReactElement {
  const client = useFragment(ClientRow_ClientStatsValuesFragment, props.client);
  const requests = useFormattedNumber(client.count);
  const hash = client.name;
  const change = useCallback(() => {
    if (hash) {
      onSelect(hash, !selected);
    }
  }, [onSelect, hash, selected]);

  return (
    <div style={style} className="flex items-center gap-4 truncate">
      <Checkbox checked={selected} onCheckedChange={change} id={hash} />
      <label
        htmlFor={hash}
        className="flex w-full cursor-pointer items-center justify-between gap-4 overflow-hidden"
      >
        <span className="grow overflow-hidden text-ellipsis">{client.name}</span>
        <div className="shrink-0 text-right text-gray-500">{requests}</div>
      </label>
    </div>
  );
}

const ClientsFilter_ClientStatsValuesConnectionFragment = graphql(`
  fragment ClientsFilter_ClientStatsValuesConnectionFragment on ClientStatsValuesConnection {
    nodes {
      name
      ...ClientRow_ClientStatsValuesFragment
    }
  }
`);

function ClientsFilter({
  onClose,
  isOpen,
  onFilter,
  clientStatsConnection,
  selected,
}: {
  onClose(): void;
  onFilter(keys: string[]): void;
  isOpen: boolean;
  clientStatsConnection: FragmentType<typeof ClientsFilter_ClientStatsValuesConnectionFragment>;
  selected?: string[];
}): ReactElement {
  const clientConnection = useFragment(
    ClientsFilter_ClientStatsValuesConnectionFragment,
    clientStatsConnection,
  );
  function getClientNames() {
    return clientConnection.nodes.map(client => client.name);
  }

  const [selectedItems, setSelectedItems] = useState<string[]>(() =>
    getClientNames().filter(name => selected?.includes(name) ?? true),
  );

  const onSelect = useCallback(
    (operationHash: string, selected: boolean) => {
      const itemAt = selectedItems.findIndex(hash => hash === operationHash);
      const exists = itemAt > -1;

      if (selected && !exists) {
        setSelectedItems([...selectedItems, operationHash]);
      } else if (!selected && exists) {
        setSelectedItems(selectedItems.filter(hash => hash !== operationHash));
      }
    },
    [selectedItems, setSelectedItems],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedFilter = useDebouncedCallback((value: string) => {
    setVisibleOperations(
      clientConnection.nodes.filter(client =>
        client.name.toLocaleLowerCase().includes(value.toLocaleLowerCase()),
      ),
    );
  }, 500);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;

      setSearchTerm(value);
      debouncedFilter(value);
    },
    [setSearchTerm, debouncedFilter],
  );

  const [visibleOperations, setVisibleOperations] = useState(clientConnection.nodes);

  const selectAll = useCallback(() => {
    setSelectedItems(getClientNames());
  }, [clientConnection.nodes]);
  const selectNone = useCallback(() => {
    setSelectedItems([]);
  }, [setSelectedItems]);

  const renderRow = useCallback<ComponentType<ListChildComponentProps>>(
    ({ index, style }) => {
      const client = visibleOperations[index];

      return (
        <ClientRow
          style={style}
          key={client.name}
          client={client}
          selected={selectedItems.includes(client.name || '')}
          onSelect={onSelect}
        />
      );
    },
    [visibleOperations, selectedItems, onSelect],
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Filter by client</SheetTitle>
        </SheetHeader>

        <div className="flex h-full flex-col space-y-3 py-4">
          <Input
            size="medium"
            placeholder="Search for operation..."
            onChange={onChange}
            value={searchTerm}
            onClear={() => {
              setSearchTerm('');
              setVisibleOperations(clientConnection.nodes);
            }}
          />
          <div className="flex w-full items-center gap-2">
            <Button variant="link" onClick={selectAll}>
              All
            </Button>
            <Button variant="link" onClick={selectNone}>
              None
            </Button>
            <Button className="ml-auto" onClick={selectAll}>
              Reset
            </Button>
            <Button
              variant="primary"
              disabled={selectedItems.length === 0}
              onClick={() => {
                onFilter(selectedItems);
                onClose();
              }}
            >
              Save
            </Button>
          </div>
          <div className="grow pl-1">
            <AutoSizer>
              {({ height, width }) =>
                !height || !width ? (
                  <></>
                ) : (
                  <FixedSizeList
                    height={height}
                    width={width}
                    itemCount={visibleOperations.length}
                    itemSize={24}
                    overscanCount={5}
                  >
                    {renderRow}
                  </FixedSizeList>
                )
              }
            </AutoSizer>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const ClientsFilterContainer_ClientStatsQuery = graphql(`
  query ClientsFilterContainer_ClientStats($selector: OperationsStatsSelectorInput!) {
    operationsStats(selector: $selector) {
      clients {
        ...ClientsFilter_ClientStatsValuesConnectionFragment
        nodes {
          __typename
        }
      }
    }
  }
`);

function ClientsFilterContainer({
  period,
  isOpen,
  onClose,
  onFilter,
  selected,
  organizationSlug,
  projectSlug,
  targetSlug,
}: {
  onFilter(keys: string[]): void;
  onClose(): void;
  isOpen: boolean;
  period: DateRangeInput;
  selected?: string[];
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement | null {
  const [query, refresh] = useQuery({
    query: ClientsFilterContainer_ClientStatsQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
        period,
        operations: [],
      },
    },
  });

  useEffect(() => {
    if (!query.fetching) {
      refresh({ requestPolicy: 'network-only' });
    }
  }, [period]);

  if (!isOpen) {
    return null;
  }

  if (query.fetching || query.error || !query.data) {
    return <Spinner />;
  }

  const allClients = query.data.operationsStats?.clients.nodes ?? [];

  return (
    <ClientsFilter
      clientStatsConnection={query.data.operationsStats.clients}
      selected={selected}
      isOpen={isOpen}
      onClose={onClose}
      onFilter={clientNames => {
        onFilter(clientNames.length === allClients.length ? [] : clientNames);
      }}
    />
  );
}

export function ClientsFilterTrigger({
  period,
  onFilter,
  selected,
  organizationSlug,
  projectSlug,
  targetSlug,
}: {
  period: DateRangeInput;
  onFilter(keys: string[]): void;
  selected?: string[];
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement {
  const [isOpen, toggle] = useToggle();

  return (
    <>
      <Button variant="outline" className="bg-accent" onClick={toggle}>
        <span>Clients ({selected?.length || 'all'})</span>
        <FilterIcon className="ml-2 size-4" />
      </Button>
      <ClientsFilterContainer
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
        targetSlug={targetSlug}
        isOpen={isOpen}
        onClose={toggle}
        period={period}
        selected={selected}
        onFilter={onFilter}
      />
    </>
  );
}
