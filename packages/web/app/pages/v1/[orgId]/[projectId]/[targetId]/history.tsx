import * as React from 'react';
import 'twin.macro';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Page } from '@/components/common';
import { TargetView } from '@/components/target/View';
import { Versions } from '@/components/target/history/Versions';

const HistoryView: React.FC = () => {
  const router = useRouteSelector();

  return (
    <Page
      title="Schema History"
      subtitle="A list of published changes for your GraphQL schema."
    >
      <div tw="flex flex-row h-full">
        <div tw="flex-grow overflow-x-auto divide-y divide-gray-200">
          <Versions
            selector={{
              organization: router.organizationId,
              project: router.projectId,
              target: router.targetId,
            }}
          />
        </div>
      </div>
    </Page>
  );
};

export default function TargetHistory() {
  return <TargetView title="History">{() => <HistoryView />}</TargetView>;
}
