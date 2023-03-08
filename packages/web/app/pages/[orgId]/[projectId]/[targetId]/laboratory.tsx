import { ReactElement } from 'react';
import { GraphiQL } from 'graphiql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { Button, DocsLink, DocsNote, Title } from '@/components/v2';
import { HiveLogo, Link2Icon } from '@/components/v2/icon';
import { ConnectLabModal } from '@/components/v2/modals/connect-lab';
import { graphql } from '@/gql';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import 'graphiql/graphiql.css';

const Page = ({ endpoint }: { endpoint: string }): ReactElement => {
  return (
    <>
      <DocsNote>
        Explore your GraphQL schema and run queries against a mocked version of your GraphQL
        service. <DocsLink href="/features/laboratory">Learn more about the Laboratory</DocsLink>
      </DocsNote>
      <style global jsx>{`
        .graphiql-container {
          --color-base: transparent !important;
          --color-primary: 40, 89%, 60% !important;
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

const TargetLaboratoryPageQuery = graphql(`
  query TargetLaboratoryPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_ProjectFragment
    }
    targets(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_TargetConnectionFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function LaboratoryPage(): ReactElement {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const router = useRouteSelector();
  const endpoint = `${location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;

  return (
    <>
      <Title title="Schema laboratory" />
      <TargetLayout
        query={TargetLaboratoryPageQuery}
        value="laboratory"
        className="flex h-full flex-col"
        connect={
          <>
            <Button size="large" variant="primary" onClick={toggleModalOpen} className="ml-auto">
              Use Schema Externally
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
