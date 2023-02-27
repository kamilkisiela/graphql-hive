import { ReactElement } from 'react';
import { GraphiQL } from 'graphiql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { Button, Title } from '@/components/v2';
import { HiveLogo } from '@/components/v2/icon';
import { ConnectLabModal } from '@/components/v2/modals/connect-lab';
import { graphql } from '@/gql';
import { useClipboard, useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { Menu, Tooltip, useEditorContext } from '@graphiql/react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { Link1Icon, Share2Icon } from '@radix-ui/react-icons';
import 'graphiql/graphiql.css';

function Share(): ReactElement {
  const { queryEditor, variableEditor, headerEditor } = useEditorContext({
    nonNull: true,
  });
  const copyToClipboard = useClipboard();

  const headers = headerEditor?.getValue();
  const variables = variableEditor?.getValue();
  const query = queryEditor?.getValue();

  const label = 'Share query';

  return (
    <Menu>
      <Tooltip label={label}>
        <Menu.Button className="graphiql-toolbar-button" aria-label={label}>
          <Share2Icon className="graphiql-toolbar-icon" />
        </Menu.Button>
      </Tooltip>

      <Menu.List>
        {['With headers', 'With variables', 'With both'].map((name, i) => (
          <Menu.Item
            key={name}
            onSelect={async () => {
              const data: { query: string; headers?: string; variables?: string } = { query };
              if (i === 0 || i === 3) data.headers = headers;
              if (i === 1 || i === 3) data.variables = variables;

              await copyToClipboard(JSON.stringify(data));
            }}
          >
            {name}
          </Menu.Item>
        ))}
      </Menu.List>
    </Menu>
  );
}

function Page({ endpoint }: { endpoint: string }): ReactElement {
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
      <GraphiQL
        fetcher={createGraphiQLFetcher({ url: endpoint })}
        toolbar={{
          additionalContent: <Share />,
        }}
      >
        <GraphiQL.Logo>
          <HiveLogo className="h-6 w-6" />
        </GraphiQL.Logo>
      </GraphiQL>
    </>
  );
}

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
  }
`);

function LaboratoryPage(): ReactElement {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const router = useRouteSelector();
  const endpoint = `${window.location.origin}/api/lab/${router.organizationId}/${router.projectId}/${router.targetId}`;

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
              Connect
              <Link1Icon className="ml-8 h-6 w-auto" />
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
