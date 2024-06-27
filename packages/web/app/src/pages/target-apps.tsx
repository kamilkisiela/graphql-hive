import { useState } from 'react';
import { LoaderCircleIcon } from 'lucide-react';
import { useClient, useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { EmptyList, noSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { SubPageLayoutHeader } from '@/components/ui/page-content-layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DocsLink, Spinner } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Link } from '@tanstack/react-router';

const AppTableRow_AppDeploymentFragment = graphql(`
  fragment AppTableRow_AppDeploymentFragment on AppDeployment {
    id
    name
    version
    status
    totalDocumentCount
  }
`);

const TargetAppsViewQuery = graphql(`
  query TargetAppsViewQuery($targetSelector: TargetSelectorInput!, $after: String) {
    target(selector: $targetSelector) {
      id
      latestSchemaVersion {
        __typename
      }
      appDeployments(first: 10, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            ...AppTableRow_AppDeploymentFragment
          }
        }
      }
    }
  }
`);

const TargetAppsViewFetchMoreQuery = graphql(`
  query TargetAppsViewFetchMoreQuery($targetSelector: TargetSelectorInput!, $after: String!) {
    target(selector: $targetSelector) {
      id
      appDeployments(first: 10, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            ...AppTableRow_AppDeploymentFragment
          }
        }
      }
    }
  }
`);

function AppTableRow(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
  appDeployment: FragmentType<typeof AppTableRow_AppDeploymentFragment>;
}) {
  const appDeployment = useFragment(AppTableRow_AppDeploymentFragment, props.appDeployment);

  return (
    <TableRow>
      <TableCell>
        <Link
          className="font-bold"
          to="/$organizationId/$projectId/$targetId/apps/$appName/$appVersion"
          params={{
            organizationId: props.organizationId,
            projectId: props.projectId,
            targetId: props.targetId,
            appName: appDeployment.name,
            appVersion: appDeployment.version,
          }}
        >
          {appDeployment.name}@{appDeployment.version}
        </Link>
      </TableCell>
      <TableCell className="hidden text-center sm:table-cell">
        <Badge className="text-xs" variant="secondary">
          {appDeployment.status}
        </Badge>
      </TableCell>
      <TableCell className="text-end">{appDeployment.totalDocumentCount}</TableCell>
    </TableRow>
  );
}

function TargetAppsView(props: { organizationId: string; projectId: string; targetId: string }) {
  const [data] = useQuery({
    query: TargetAppsViewQuery,
    variables: {
      targetSelector: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
      },
    },
  });
  const client = useClient();

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  if (data.fetching) {
    return (
      <div className="flex h-fit flex-1 items-center justify-center">
        <div className="flex flex-col items-center">
          <Spinner />
          <div className="mt-2 text-xs">Loading app deployments</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col py-6">
      <SubPageLayoutHeader
        title="App Deployments"
        description={
          <>
            <CardDescription>
              App deployments empower you to group your GraphQL operations by version and leverage
              granular app version statistics and persisted operations.
            </CardDescription>
            <CardDescription>
              <DocsLink
                href="/management/targets#cdn-access-tokens"
                className="text-gray-500 hover:text-gray-300"
              >
                Learn more about App Deployments
              </DocsLink>
            </CardDescription>
          </>
        }
      />
      <div className="mt-4" />
      {!data.data?.target?.latestSchemaVersion ? (
        noSchemaVersion
      ) : !data.data.target.appDeployments ? (
        <EmptyList
          title="Hive is waiting for your first app deployment"
          description="You can create an app deployment with the Hive CLI"
          docsUrl="/features/schema-registry#app-deplyments"
        />
      ) : (
        <div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">App@Version</TableHead>
                  <TableHead className="hidden text-center sm:table-cell">Status</TableHead>
                  <TableHead className="hidden text-end sm:table-cell">
                    Amount of Documents
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data?.target?.appDeployments?.edges.map(edge => (
                  <AppTableRow
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                    targetId={props.targetId}
                    appDeployment={edge.node}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              className="ml-auto mr-0 flex"
              disabled={!data?.data?.target?.appDeployments?.pageInfo?.hasNextPage || isLoadingMore}
              onClick={() => {
                if (
                  data?.data?.target?.appDeployments?.pageInfo?.endCursor &&
                  data?.data?.target?.appDeployments?.pageInfo?.hasNextPage
                ) {
                  setIsLoadingMore(true);
                  client
                    .query(TargetAppsViewFetchMoreQuery, {
                      targetSelector: {
                        organization: props.organizationId,
                        project: props.projectId,
                        target: props.targetId,
                      },
                      after: data?.data?.target?.appDeployments?.pageInfo?.endCursor,
                    })
                    .toPromise()
                    .finally(() => {
                      setIsLoadingMore(false);
                    });
                }
              }}
            >
              {isLoadingMore ? (
                <>
                  <LoaderCircleIcon className="rotate mr-2 inline size-4 animate-spin" /> Loading
                </>
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TargetAppsPage(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  return (
    <>
      <Meta title="App Deployments" />
      <TargetLayout
        targetId={props.targetId}
        projectId={props.projectId}
        organizationId={props.organizationId}
        page={Page.Apps}
      >
        <TargetAppsView
          organizationId={props.organizationId}
          projectId={props.projectId}
          targetId={props.targetId}
        />
      </TargetLayout>
    </>
  );
}
