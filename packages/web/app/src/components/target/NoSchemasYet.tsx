import { EmptyList } from '@/components/common/EmptyList';
import React from 'react';
import 'twin.macro';

export const NoSchemasYet: React.FC = () => {
  return (
    <div>
      <EmptyList
        title="Hive is waiting for your first schema"
        description="You can publish a schema with Hive CLI and Hive Client"
        documentationLink={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/publish-schema`}
      />
    </div>
  );
};
