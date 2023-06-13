import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { SchemaEditor } from '@/components/schema-editor';
import { Badge, DiffEditor, Heading, TimeAgo, Title } from '@/components/v2';
import { AlertTriangleIcon, DiffIcon } from '@/components/v2/icon';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { ListBulletIcon } from '@radix-ui/react-icons';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

const ChecksPageQuery = graphql(`
  query ChecksPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
    }
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
  }
`);

const SchemaChecks_NavigationQuery = graphql(`
  query SchemaChecks_NavigationQuery(
    $organizationId: ID!
    $projectId: ID!
    $targetId: ID!
    $after: String
  ) {
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      schemaChecks(first: 20, after: $after) {
        edges {
          node {
            __typename
            id
            createdAt
            serviceName
            meta {
              commit
              author
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
        }
      }
    }
  }
`);

const Navigation = (): React.ReactElement => {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: SchemaChecks_NavigationQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
    },
  });

  return (
    <div className="flex h-0 min-w-[420px] grow flex-col gap-2.5 overflow-y-auto rounded-md border border-gray-800/50 p-2.5">
      {query.fetching
        ? null
        : query.data?.target?.schemaChecks.edges.map(edge => (
            <div
              className={clsx(
                'flex flex-col rounded-md p-2.5 hover:bg-gray-800/40',
                edge.node.id === router.schemaCheckId ? 'bg-gray-800/40' : null,
              )}
            >
              <NextLink
                key={edge.node.id}
                href={`/${router.organizationId}/${router.projectId}/${router.targetId}/checks/${edge.node.id}`}
                scroll={false} // disable the scroll to top on page
              >
                <h3 className="truncate font-bold">{edge.node.meta?.commit ?? edge.node.id}</h3>
                {edge.node.meta?.author ? (
                  <div className="truncate text-xs font-medium text-gray-500">
                    <span className="overflow-hidden truncate">{edge.node.meta.author}</span>
                  </div>
                ) : null}
                <div className="mt-2.5 mb-1.5 flex align-middle text-xs font-medium text-[#c4c4c4]">
                  <div
                    className={clsx(
                      'w-1/2 ',
                      edge.node.__typename === 'FailedSchemaCheck' ? 'text-red-500' : null,
                    )}
                  >
                    <Badge color={edge.node.__typename === 'FailedSchemaCheck' ? 'red' : 'green'} />{' '}
                    <TimeAgo date={edge.node.createdAt} />
                  </div>

                  {edge.node.serviceName ? (
                    <div className="ml-auto mr-0 w-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-right font-bold">
                      {edge.node.serviceName}
                    </div>
                  ) : null}
                </div>
              </NextLink>
            </div>
          ))}
    </div>
  );
};

const ActiveSchemaCheckQuery = graphql(`
  query ActiveSchemaCheckQuery(
    $organizationId: ID!
    $projectId: ID!
    $targetId: ID!
    $schemaCheckId: ID!
  ) {
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      schemaCheck(id: $schemaCheckId) {
        __typename
        id
        schemaSDL
        schemaVersion {
          id
          supergraph
          sdl
        }
        serviceName
        createdAt
        meta {
          commit
          author
        }
        ... on FailedSchemaCheck {
          compositeSchemaSDL
          supergraphSDL
          compositionErrors {
            nodes {
              message
            }
          }
          breakingSchemaChanges {
            nodes {
              message
            }
          }
          safeSchemaChanges {
            nodes {
              message
            }
          }
          schemaPolicyWarnings {
            ...SchemaPolicyEditor_PolicyWarningsFragment
            edges {
              node {
                message
              }
            }
          }
          schemaPolicyErrors {
            ...SchemaPolicyEditor_PolicyWarningsFragment
            edges {
              node {
                message
              }
            }
          }
        }
        ... on SuccessfulSchemaCheck {
          compositeSchemaSDL
          supergraphSDL
          safeSchemaChanges {
            nodes {
              message
            }
          }
          schemaPolicyWarnings {
            ...SchemaPolicyEditor_PolicyWarningsFragment
            edges {
              node {
                message
              }
            }
          }
        }
      }
    }
  }
`);

const ActiveSchemaCheck = (): React.ReactElement | null => {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ActiveSchemaCheckQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
      schemaCheckId: router.schemaCheckId ?? '',
    },
    pause: !router.schemaCheckId,
  });
  const [view, setView] = useState<string>('details');

  const [toggleItems] = useMemo(() => {
    const items: Array<{
      value: string;
      icon: JSX.Element;
      label: string;
      tooltip: string;
    }> = [];

    if (!query?.data?.target?.schemaCheck) {
      return [[]] as const;
    }

    items.push({
      value: 'details',
      icon: <ListBulletIcon className="h-5 w-auto flex-none" />,
      label: 'Details',
      tooltip: 'Details',
    });

    if (query.data.target.schemaCheck.compositeSchemaSDL) {
      items.push({
        value: 'schema',
        icon: <DiffIcon className="h-5 w-auto flex-none" />,
        label: 'Schema',
        tooltip: 'Schema',
      });
    }

    if (query.data.target.schemaCheck.supergraphSDL) {
      items.push({
        value: 'supergraph',
        icon: <DiffIcon className="h-5 w-auto flex-none" />,
        label: 'Supergraph',
        tooltip: 'Supergraph',
      });
    }

    if (
      query.data.target.schemaCheck.compositeSchemaSDL &&
      query.data.target.schemaCheck.supergraphSDL
    ) {
      items.push({
        value: 'schemaDiff',
        icon: <DiffIcon className="h-5 w-auto flex-none" />,
        label: 'Diff',
        tooltip: 'Schema Diff',
      });
    }

    if (
      query.data.target.schemaCheck.schemaPolicyWarnings ||
      ('schemaPolicyErrors' in query.data.target.schemaCheck &&
        query.data.target.schemaCheck.schemaPolicyErrors)
    ) {
      items.push({
        value: 'policy',
        icon: <AlertTriangleIcon className="h-5 w-auto flex-none" />,
        label: 'Policy',
        tooltip: 'Schema Policy',
      });
    }

    return [items] as const;
  }, [query.data?.target?.schemaCheck]);

  if (!query.data?.target?.schemaCheck) {
    return null;
  }

  const { schemaCheck } = query.data.target;

  return (
    <div className="flex grow flex-col">
      <div className="flex items-center justify-between mb-4">
        <Heading>Check {schemaCheck.id}</Heading>
      </div>
      <div className="flex flex-col gap-2 mb-1">
        <div className="mb-1.5 flex align-middle font-medium p-2 text-[#c4c4c4] rounded-md border-gray-800 border space-x-4">
          <div>
            <div className="text-xs">
              Triggered <TimeAgo date={schemaCheck.createdAt} />
            </div>
            <div className="text-white text-sm">
              by {schemaCheck.meta ? <>{schemaCheck.meta.author}</> : 'unknown'}
            </div>
          </div>
          <div>
            <div className="text-xs">Commit</div>
            <div>
              <div className="text-white text-sm font-bold">
                {schemaCheck.meta?.commit ?? 'unknown'}
              </div>
            </div>
          </div>
          {schemaCheck.serviceName ? (
            <div>
              <div className="text-xs">Service</div>
              <div>
                <div className="text-white text-sm font-bold">{schemaCheck.serviceName}</div>
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-xs">Status</div>
            <div className="text-white text-sm font-bold">
              {schemaCheck.__typename === 'FailedSchemaCheck' ? <>Failed</> : <>Success</>}
            </div>
          </div>
        </div>
      </div>

      <ToggleGroup.Root
        className="flex space-x-1 rounded-md bg-gray-900/50 text-gray-500 p-0.5 mb-2"
        type="single"
        defaultValue={view}
        onValueChange={value => setView(value as any)}
        orientation="vertical"
      >
        {toggleItems.map(item => (
          <ToggleGroup.Item
            key={item.value}
            value={item.value}
            className={clsx(
              'flex items-center rounded-md py-[0.4375rem] px-2 text-xs font-semibold hover:text-white',
              view === item.value && 'bg-gray-800 text-white',
            )}
            title={item.tooltip}
          >
            {item.icon}
            <span className="ml-2">{item.label}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      {view === 'details' ? (
        <>
          <>
            {'compositionErrors' in schemaCheck && schemaCheck.compositionErrors ? (
              <div className="mb-2">
                <Heading>
                  <Badge color="red" /> Composition Errors
                </Heading>
                <ul>
                  {schemaCheck.compositionErrors.nodes.map((change, index) => (
                    <li key={index}>{change.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {'breakingSchemaChanges' in schemaCheck && schemaCheck.breakingSchemaChanges ? (
              <div className="mb-2">
                <Heading>
                  <Badge color="red" /> Breaking Schema Changes
                </Heading>
                <ul>
                  {schemaCheck.breakingSchemaChanges.nodes.map((change, index) => (
                    <li key={index}>{change.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {schemaCheck.safeSchemaChanges ? (
              <div className="mb-2">
                <Heading>
                  <Badge color="green" /> Safe Schema Changes
                </Heading>
                <ul>
                  {schemaCheck.safeSchemaChanges.nodes.map((change, index) => (
                    <li key={index}>{change.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {'schemaPolicyErrors' in schemaCheck && schemaCheck.schemaPolicyErrors ? (
              <div className="mb-2">
                <Heading>
                  <Badge color="red" /> Schema Policy Errors
                </Heading>
                <ul>
                  {schemaCheck.schemaPolicyErrors.edges.map((edge, index) => (
                    <li key={index}>{edge.node.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {schemaCheck.schemaPolicyWarnings ? (
              <div className="mb-2">
                <Heading>
                  <Badge color="yellow" /> Schema Policy Warnings
                </Heading>
                <ul>
                  {schemaCheck.schemaPolicyWarnings.edges.map((edge, index) => (
                    <li key={index}>{edge.node.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        </>
      ) : null}
      {view === 'schema' ? (
        <SchemaEditor
          theme="vs-dark"
          options={{
            renderLineHighlightOnlyWhenFocus: true,
            readOnly: true,
            lineNumbers: 'off',
            renderValidationDecorations: 'on',
          }}
          schema={schemaCheck.compositeSchemaSDL ?? ''}
        />
      ) : null}
      {view === 'supergraph' ? (
        <SchemaEditor
          theme="vs-dark"
          options={{
            renderLineHighlightOnlyWhenFocus: true,
            readOnly: true,
            lineNumbers: 'off',
            renderValidationDecorations: 'on',
          }}
          schema={schemaCheck.supergraphSDL ?? ''}
        />
      ) : null}
      {view === 'schemaDiff' ? (
        <DiffEditor
          before={schemaCheck.schemaVersion?.sdl ?? ''}
          after={schemaCheck.compositeSchemaSDL ?? ''}
          title="Schema Diff"
        />
      ) : null}
      {view === 'policy' && schemaCheck.compositeSchemaSDL ? (
        <SchemaPolicyEditor
          compositeSchemaSDL={schemaCheck.schemaSDL ?? ''}
          warnings={schemaCheck.schemaPolicyWarnings ?? null}
          errors={('schemaPolicyErrors' in schemaCheck && schemaCheck.schemaPolicyErrors) || null}
        />
      ) : null}
    </div>
  );
};

const SchemaPolicyEditor_PolicyWarningsFragment = graphql(`
  fragment SchemaPolicyEditor_PolicyWarningsFragment on SchemaPolicyWarningConnection {
    edges {
      node {
        message
        start {
          line
          column
        }
        end {
          line
          column
        }
      }
    }
  }
`);

const SchemaPolicyEditor = (props: {
  compositeSchemaSDL: string;
  warnings: FragmentType<typeof SchemaPolicyEditor_PolicyWarningsFragment> | null;
  errors: FragmentType<typeof SchemaPolicyEditor_PolicyWarningsFragment> | null;
}) => {
  const warnings = useFragment(SchemaPolicyEditor_PolicyWarningsFragment, props.warnings);
  const errors = useFragment(SchemaPolicyEditor_PolicyWarningsFragment, props.errors);
  return (
    <SchemaEditor
      theme="vs-dark"
      options={{
        renderLineHighlightOnlyWhenFocus: true,
        readOnly: true,
        lineNumbers: 'off',
        renderValidationDecorations: 'on',
      }}
      onMount={(_, monaco) => {
        monaco.editor.setModelMarkers(monaco.editor.getModels()[0], 'owner', [
          ...(warnings?.edges.map(edge => ({
            message: edge.node.message,
            startLineNumber: edge.node.start.line,
            startColumn: edge.node.start.column,
            endLineNumber: edge.node.end?.line ?? edge.node.start.line,
            endColumn: edge.node.end?.column ?? edge.node.start.column,
            severity: monaco.MarkerSeverity.Warning,
          })) ?? []),
          ...(errors?.edges.map(edge => ({
            message: edge.node.message,
            startLineNumber: edge.node.start.line,
            startColumn: edge.node.start.column,
            endLineNumber: edge.node.end?.line ?? edge.node.start.line,
            endColumn: edge.node.end?.column ?? edge.node.start.column,
            severity: monaco.MarkerSeverity.Error,
          })) ?? []),
        ]);
      }}
      schema={props.compositeSchemaSDL}
    />
  );
};

function ChecksPage() {
  return (
    <>
      <Title title="Schema Checks" />
      <TargetLayout
        value="checks"
        className="flex h-full items-stretch gap-x-5"
        query={ChecksPageQuery}
      >
        {() => {
          return (
            <>
              <div className="flex flex-col gap-4">
                <Heading>Schema Checks</Heading>
                <Navigation />
              </div>
              <ActiveSchemaCheck />
            </>
          );
        }}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ChecksPage);
