import { ReactElement } from 'react';
import { createGraphiQLFetcher } from '@graphiql/toolkit'; // eslint-disable-line import/no-extraneous-dependencies
import { GraphiQL } from 'graphiql';
import { useQuery } from 'urql';

import { TargetLayout } from '@/components/layouts';
import { noSchema, Spinner, Title } from '@/components/v2';
import { HiveLogo } from '@/components/v2/icon';
import { SchemasDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import 'graphiql/graphiql.css';

const Page = () => {
  const router = useRouteSelector();
  const [schemasQuery] = useQuery({
    query: SchemasDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const hasSchemas = schemasQuery.data?.target.latestSchemaVersion?.schemas.nodes.length > 0;
  const endpoint = `${window.location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;
  return (
    <>
      <p className="mb-5 font-light text-gray-500">
        Experiment, mock and create live environment for your schema, without running any backend.
      </p>
      {schemasQuery.fetching ? (
        <Spinner className="mt-10" />
      ) : hasSchemas ? (
        <>
          <GraphiQL fetcher={createGraphiQLFetcher({ url: endpoint })}>
            <GraphiQL.Logo>
              <HiveLogo className="h-6 w-6 brightness-0" />
            </GraphiQL.Logo>
          </GraphiQL>
          <style jsx global>{`
            .graphiql-container {
              filter: invert(1);
            }
          `}</style>
        </>
      ) : (
        noSchema
      )}
    </>
  );
};

export default function LaboratoryPage(): ReactElement {
  return (
    <>
      <Title title="Schema laboratory" />
      <TargetLayout value="laboratory" className="h-[500px] pb-10">
        {() => <Page />}
      </TargetLayout>
    </>
  );
}
