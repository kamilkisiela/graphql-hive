import { ReactElement, useCallback, useState } from 'react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { GraphiQL } from 'graphiql';

import { TargetLayout } from '@/components/layouts';
import { Button, Title } from '@/components/v2';
import { HiveLogo, Link2Icon } from '@/components/v2/icon';
import { ConnectLabModal } from '@/components/v2/modals/connect-lab';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import 'graphiql/graphiql.css';

const Page = ({ endpoint }: { endpoint: string }): ReactElement => {
  return (
    <>
      <p className="mb-5 font-light text-gray-500">
        Experiment, mock and create live environment for your schema, without running any backend.
      </p>
      <GraphiQL fetcher={createGraphiQLFetcher({ url: endpoint })}>
        <GraphiQL.Logo>
          <HiveLogo className="h-6 w-6 brightness-0" />
          <style jsx global>{`
            .graphiql-container {
              filter: invert(1);
            }
          `}</style>
        </GraphiQL.Logo>
      </GraphiQL>
    </>
  );
};

export default function LaboratoryPage(): ReactElement {
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen(prevOpen => !prevOpen);
  }, []);
  const router = useRouteSelector();
  const endpoint = `${window.location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;

  return (
    <>
      <Title title="Schema laboratory" />
      <TargetLayout
        value="laboratory"
        className="flex h-full flex-col"
        connect={
          <>
            <Button size="large" variant="primary" onClick={toggleModalOpen} className="ml-auto">
              Connect
              <Link2Icon className="ml-8 h-4 w-4" />
            </Button>
            <ConnectLabModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} endpoint={endpoint} />
          </>
        }
      >
        {() => <Page endpoint={endpoint} />}
      </TargetLayout>
    </>
  );
}
