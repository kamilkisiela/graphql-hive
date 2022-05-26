import { ReactElement } from 'react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { GraphiQL } from 'graphiql';

import { TargetLayout } from '@/components/layouts';
import { Title } from '@/components/v2';
import { HiveLogo } from '@/components/v2/icon';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import 'graphiql/graphiql.css';

const Page = (): ReactElement => {
  const router = useRouteSelector();

  const endpoint = `${window.location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;

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
  return (
    <>
      <Title title="Schema laboratory" />
      <TargetLayout value="laboratory" className="flex h-full flex-col">
        {() => <Page />}
      </TargetLayout>
    </>
  );
}
