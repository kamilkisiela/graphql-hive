import React from 'react';
import 'twin.macro';
import { EmptyList } from '@/components/common/EmptyList';

export const NoPersistedOperationsYet: React.FC<{
  project: string;
}> = () => {
  return (
    <div>
      <EmptyList
        title="Hive is waiting for your first persisted operation"
        description="You can persist operations using Hive CLI"
        documentationLink={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/persisted-operations`}
      >
        Please push your operations using the CLI
      </EmptyList>
    </div>
  );
};
