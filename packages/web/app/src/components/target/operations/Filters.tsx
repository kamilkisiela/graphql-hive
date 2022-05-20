import React from 'react';
import 'twin.macro';
import {
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  useDisclosure,
} from '@chakra-ui/react';
import { VscChevronDown, VscChromeClose } from 'react-icons/vsc';
import { AutoSizer, List } from 'react-virtualized';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';

import { Spinner } from '@/components/common/Spinner';
import { DateRangeInput, OperationsStatsDocument, OperationStatsFieldsFragment } from '@/graphql';
import { useFormattedNumber } from '@/lib/hooks/use-formatted-number';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const OperationsFilter: React.FC<{
  onClose(): void;
  onFilter(keys: string[]): void;
  isOpen: boolean;
  focusRef: React.RefObject<any>;
  operations: readonly OperationStatsFieldsFragment[];
  selected?: string[];
}> = ({ onClose, isOpen, onFilter, focusRef, operations, selected }) => {
  const [selectedItems, setSelectedItems] = React.useState<string[]>(
    selected?.length > 0 ? selected : operations.map(op => op.operationHash)
  );
  const onSelect = React.useCallback(
    (operationHash: string, selected: boolean) => {
      const itemAt = selectedItems.findIndex(hash => hash === operationHash);
      const exists = itemAt > -1;

      if (selected && !exists) {
        setSelectedItems([...selectedItems, operationHash]);
      } else if (!selected && exists) {
        setSelectedItems(selectedItems.filter(hash => hash !== operationHash));
      }
    },
    [selectedItems, setSelectedItems]
  );
  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedFilter = useDebouncedCallback((value: string) => {
    setVisibleOperations(operations.filter(op => op.name.toLocaleLowerCase().includes(value)));
  }, 500);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;

      setSearchTerm(value);
      debouncedFilter(value);
    },
    [setSearchTerm, debouncedFilter]
  );

  const [visibleOperations, setVisibleOperations] = React.useState(operations);

  const selectAll = React.useCallback(() => {
    setSelectedItems(operations.map(op => op.operationHash));
  }, [operations]);
  const selectNone = React.useCallback(() => {
    setSelectedItems([]);
  }, [setSelectedItems]);

  return (
    <Drawer onClose={onClose} finalFocusRef={focusRef} isOpen={isOpen} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerHeader bgColor="gray.900">Filter by operation</DrawerHeader>
        <DrawerCloseButton />
        <DrawerBody bgColor="gray.900">
          <div tw="flex flex-col h-full space-y-3">
            <InputGroup>
              <Input pr="3rem" placeholder="Search for operation..." onChange={onChange} value={searchTerm} />
              <InputRightElement width="3rem">
                <IconButton
                  variant="ghost"
                  h="1.75rem"
                  size="sm"
                  icon={<VscChromeClose />}
                  aria-label="Clear"
                  onClick={() => {
                    setSearchTerm('');
                    setVisibleOperations(operations);
                  }}
                />
              </InputRightElement>
            </InputGroup>
            <div tw="flex flex-row justify-between items-center">
              <div>
                <Button variant="link" size="xs" onClick={selectAll}>
                  All
                </Button>{' '}
                <Button variant="link" size="xs" onClick={selectNone}>
                  None
                </Button>
              </div>
              <div tw="flex flex-row">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Reset
                </Button>
                <Button
                  colorScheme="primary"
                  size="sm"
                  disabled={selectedItems.length === 0}
                  onClick={() => {
                    onFilter(selectedItems);
                    onClose();
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
            <div tw="pl-1 flex-grow">
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    width={width}
                    rowCount={visibleOperations.length}
                    rowHeight={24}
                    overscanRowCount={5}
                    rowRenderer={({ index, style }) => {
                      const operation = visibleOperations[index];

                      return (
                        <OperationRow
                          style={style}
                          key={operation.id}
                          operation={operation}
                          selected={selectedItems.some(operationHash => operationHash === operation.operationHash)}
                          onSelect={onSelect}
                        />
                      );
                    }}
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};

const OperationsFilterContainer: React.FC<{
  onFilter(keys: string[]): void;
  onClose(): void;
  isOpen: boolean;
  focusRef: React.RefObject<any>;
  period: DateRangeInput;
  selected?: string[];
}> = ({ period, isOpen, onClose, onFilter, focusRef, selected }) => {
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

  if (query.fetching || query.error) {
    return <Spinner />;
  }

  const allOperations = query.data.operationsStats?.operations?.nodes ?? [];

  return (
    <OperationsFilter
      operations={allOperations}
      selected={selected}
      isOpen={isOpen}
      onClose={onClose}
      focusRef={focusRef}
      onFilter={hashes => {
        onFilter(hashes.length === allOperations.length ? [] : hashes);
      }}
    />
  );
};

const OperationRow: React.FC<{
  operation: OperationStatsFieldsFragment;
  selected: boolean;
  onSelect(id: string, selected: boolean): void;
  style: any;
}> = ({ operation, selected, onSelect, style }) => {
  const requests = useFormattedNumber(operation.count);
  const change = React.useCallback(() => {
    onSelect(operation.operationHash, !selected);
  }, [onSelect, operation.operationHash, selected]);

  return (
    <div style={style} tw="flex flex-row space-x-4 items-center">
      <Checkbox colorScheme="primary" isChecked={selected} onChange={change} />
      <div tw="flex flex-grow flex-row items-center cursor-pointer">
        <button tw="flex-grow overflow-ellipsis overflow-hidden whitespace-nowrap" onClick={change}>
          {operation.name}
        </button>
        <button tw="width[75px] flex-shrink-0 text-right text-gray-500" onClick={change}>
          {requests}
        </button>
      </div>
    </div>
  );
};

export const OperationsFilterTrigger: React.FC<{
  period: DateRangeInput;
  onFilter(keys: string[]): void;
  selected?: string[];
}> = ({ period, onFilter, selected }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const ref = React.useRef();

  return (
    <>
      <Button
        ref={ref}
        rightIcon={<VscChevronDown />}
        size="sm"
        onClick={onOpen}
        borderRadius="sm"
        bgColor="whiteAlpha.50"
        _hover={{ bgColor: 'whiteAlpha.100' }}
      >
        <span tw="font-normal">Operations ({selected?.length > 0 ? selected.length : 'all'})</span>
      </Button>
      <OperationsFilterContainer
        isOpen={isOpen}
        onClose={onClose}
        focusRef={ref}
        period={period}
        selected={selected}
        onFilter={onFilter}
      />
    </>
  );
};
