import { ReactElement } from 'react';
import { GraphiQL } from 'graphiql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { Button, Title } from '@/components/v2';
import { HiveLogo, Link2Icon } from '@/components/v2/icon';
import { ConnectLabModal } from '@/components/v2/modals/connect-lab';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import 'graphiql/graphiql.css';

const Page = ({ endpoint }: { endpoint: string }): ReactElement => {
  return (
    <>
      <p className="mb-5 font-light text-gray-500">
        Experiment, mock and create live environment for your schema, without running any backend.
      </p>
      <style global jsx>{`
        body.graphiql-dark .graphiql-container {
          --color-base: transparent;
          --color-primary: 40, 89%, 60%;
        }
      `}</style>
      <GraphiQL fetcher={createGraphiQLFetcher({ url: endpoint })}>
        <GraphiQL.Logo>
          <HiveLogo className="h-6 w-6" />
        </GraphiQL.Logo>
      </GraphiQL>
    </>
  );
};

function LaboratoryPage(): ReactElement {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const router = useRouteSelector();
  const endpoint = `${location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;

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
            <ConnectLabModal
              isOpen={isModalOpen}
              toggleModalOpen={toggleModalOpen}
              endpoint={endpoint}
            />
          </>
        }
      >
        {() => <Page endpoint={endpoint} />}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(LaboratoryPage);
