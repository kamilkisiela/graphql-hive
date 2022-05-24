import React from 'react';
import 'twin.macro';
import { TimeAgo, HorizontalSelect } from '@/components/common';
import { PersistedOperationFieldsFragment } from '@/graphql';

export const PersistedOperations: React.FC<{
  persistedOperations: PersistedOperationFieldsFragment[];
  onSelect(id: string): void;
  selected: string;
}> = ({ persistedOperations, onSelect, selected }) => {
  return (
    <HorizontalSelect.List>
      {persistedOperations.map(operation => {
        return (
          <HorizontalSelect.Row
            key={operation.id}
            onClick={() => onSelect(operation.operationHash)}
            selected={selected === operation.operationHash}
          >
            <HorizontalSelect.Item tw="px-4 flex-grow truncate">
              {operation.operationHash.substr(0, 7)}_{operation.name}
            </HorizontalSelect.Item>
            <HorizontalSelect.Item tw="text-center flex-shrink-0 text-xs text-gray-500">
              {operation.kind}
            </HorizontalSelect.Item>
            <HorizontalSelect.Date>
              <TimeAgo date={new Date().toISOString()} />
            </HorizontalSelect.Date>
          </HorizontalSelect.Row>
        );
      })}
    </HorizontalSelect.List>
  );
};
