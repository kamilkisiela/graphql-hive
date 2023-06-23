import { ChangeEvent, ComponentType, ReactElement, useCallback, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { Button, Checkbox, Drawer, Input, Spinner } from '@/components/v2';
import { DateRangeInput, OperationsStatsDocument, OperationStatsFieldsFragment } from '@/graphql';
import { useFormattedNumber, useRouteSelector, useToggle } from '@/lib/hooks';
import { ChevronUpIcon } from '@radix-ui/react-icons';

function OperationsFilter({
  onClose,
  isOpen,
  onFilter,
  operations,
  selected,
}: {
  onClose(): void;
  onFilter(keys: string[]): void;
  isOpen: boolean;
  operations: readonly OperationStatsFieldsFragment[];
  selected?: string[];
}): ReactElement {
  function getOperationHashes() {
    const items: string[] = [];
    for (const op of operations) {
      if (op.operationHash) {
        items.push(op.operationHash);
      }
    }
    return items;
  }

  const [selectedItems, setSelectedItems] = useState<string[]>(() =>
    selected?.length ? selected : getOperationHashes(),
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
      operations.filter(op => op.name.toLocaleLowerCase().includes(value.toLocaleLowerCase())),
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

  const [visibleOperations, setVisibleOperations] = useState(operations);

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
          operation={operation}
          selected={selectedItems.includes(operation.operationHash || '')}
          onSelect={onSelect}
        />
      );
    },
    [visibleOperations, selectedItems, onSelect],
  );

  return (
    <Drawer open={isOpen} onOpenChange={onClose} width={500}>
      <Drawer.Title>Filter by operation</Drawer.Title>

      <div className="flex flex-col h-full space-y-3">
        <Input
          size="medium"
          placeholder="Search for operation..."
          onChange={onChange}
          value={searchTerm}
          onClear={() => {
            setSearchTerm('');
            setVisibleOperations(operations);
          }}
        />
        <div className="flex gap-2 items-center w-full">
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
        <div className="pl-1 grow">
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
    </Drawer>
  );
}

function OperationsFilterContainer({
  period,
  isOpen,
  onClose,
  onFilter,
  selected,
}: {
  onFilter(keys: string[]): void;
  onClose(): void;
  isOpen: boolean;
  period: DateRangeInput;
  selected?: string[];
}): ReactElement | null {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: OperationsStatsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
        period,
        operations: [],
      },
    },
  });

  if (!isOpen) {
    return null;
  }

  if (query.fetching || query.error || !query.data) {
    return <Spinner />;
  }

  const allOperations = query.data.operationsStats?.operations?.nodes ?? [];

  return (
    <OperationsFilter
      operations={allOperations}
      selected={selected}
      isOpen={isOpen}
      onClose={onClose}
      onFilter={hashes => {
        onFilter(hashes.length === allOperations.length ? [] : hashes);
      }}
    />
  );
}

function OperationRow({
  operation,
  selected,
  onSelect,
  style,
}: {
  operation: OperationStatsFieldsFragment;
  selected: boolean;
  onSelect(id: string, selected: boolean): void;
  style: any;
}): ReactElement {
  const requests = useFormattedNumber(operation.count);
  const hash = operation.operationHash || '';
  const change = useCallback(() => {
    if (hash) {
      onSelect(hash, !selected);
    }
  }, [onSelect, hash, selected]);

  return (
    <div style={style} className="flex items-center gap-4">
      <Checkbox checked={selected} onCheckedChange={change} id={hash} />
      <label
        htmlFor={hash}
        className="flex items-center justify-between overflow-hidden gap-4 w-full cursor-pointer"
      >
        <span className="grow text-ellipsis overflow-hidden">{operation.name}</span>
        <div className="shrink-0 text-right text-gray-500">{requests}</div>
      </label>
    </div>
  );
}

export function OperationsFilterTrigger({
  period,
  onFilter,
  selected,
}: {
  period: DateRangeInput;
  onFilter(keys: string[]): void;
  selected?: string[];
}): ReactElement {
  const [isOpen, toggle] = useToggle();

  return (
    <>
      <Button variant="secondary" className="gap-2 rounded-md" onClick={toggle}>
        Operations ({selected?.length || 'all'})<ChevronUpIcon className="rotate-180" />
      </Button>
      <OperationsFilterContainer
        isOpen={isOpen}
        onClose={toggle}
        period={period}
        selected={selected}
        onFilter={onFilter}
      />
    </>
  );
}

function ClientRow({
  client,
  selected,
  onSelect,
  style,
}: {
  client: { name: string; count: number };
  selected: boolean;
  onSelect(id: string, selected: boolean): void;
  style: any;
}): ReactElement {
  const requests = useFormattedNumber(client.count);
  const hash = client.name;
  const change = useCallback(() => {
    if (hash) {
      onSelect(hash, !selected);
    }
  }, [onSelect, hash, selected]);

  return (
    <div style={style} className="flex items-center gap-4">
      <Checkbox checked={selected} onCheckedChange={change} id={hash} />
      <label
        htmlFor={hash}
        className="flex items-center justify-between overflow-hidden gap-4 w-full cursor-pointer"
      >
        <span className="grow text-ellipsis overflow-hidden">{client.name}</span>
        <div className="shrink-0 text-right text-gray-500">{requests}</div>
      </label>
    </div>
  );
}

function ClientsFilter({
  onClose,
  isOpen,
  onFilter,
  clients,
  selected,
}: {
  onClose(): void;
  onFilter(keys: string[]): void;
  isOpen: boolean;
  clients: readonly { name: string; count: number }[];
  selected?: string[];
}): ReactElement {
  function getClientNames() {
    return clients.map(client => client.name);
  }

  const [selectedItems, setSelectedItems] = useState<string[]>(() =>
    selected?.length ? selected : getClientNames(),
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
      clients.filter(client => client.name.toLocaleLowerCase().includes(value.toLocaleLowerCase())),
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

  const [visibleOperations, setVisibleOperations] = useState(clients);

  const selectAll = useCallback(() => {
    setSelectedItems(getClientNames());
  }, [clients]);
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
    <Drawer open={isOpen} onOpenChange={onClose} width={500}>
      <Drawer.Title>Filter by client</Drawer.Title>

      <div className="flex flex-col h-full space-y-3">
        <Input
          size="medium"
          placeholder="Search for operation..."
          onChange={onChange}
          value={searchTerm}
          onClear={() => {
            setSearchTerm('');
            setVisibleOperations(clients);
          }}
        />
        <div className="flex gap-2 items-center w-full">
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
        <div className="pl-1 grow">
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
    </Drawer>
  );
}

function ClientsFilterContainer({
  period,
  isOpen,
  onClose,
  onFilter,
  selected,
}: {
  onFilter(keys: string[]): void;
  onClose(): void;
  isOpen: boolean;
  period: DateRangeInput;
  selected?: string[];
}): ReactElement | null {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: OperationsStatsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
        period,
        operations: [],
      },
    },
  });

  if (!isOpen) {
    return null;
  }

  if (query.fetching || query.error || !query.data) {
    return <Spinner />;
  }

  const allClients = query.data.operationsStats?.clients?.nodes ?? [];

  return (
    <ClientsFilter
      clients={allClients}
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
}: {
  period: DateRangeInput;
  onFilter(keys: string[]): void;
  selected?: string[];
}): ReactElement {
  const [isOpen, toggle] = useToggle();

  return (
    <>
      <Button variant="secondary" className="gap-2 rounded-md" onClick={toggle}>
        Clients ({selected?.length || 'all'})<ChevronUpIcon className="rotate-180" />
      </Button>
      <ClientsFilterContainer
        isOpen={isOpen}
        onClose={toggle}
        period={period}
        selected={selected}
        onFilter={onFilter}
      />
    </>
  );
}
