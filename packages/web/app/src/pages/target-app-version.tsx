import { useEffect, useState } from 'react';
import ghost from '../../public/images/figures/ghost.svg?url';
import { LoaderCircleIcon } from 'lucide-react';
import { useClient, useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyList } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { SubPageLayoutHeader } from '@/components/ui/page-content-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { graphql } from '@/gql';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { Link, useRouter } from '@tanstack/react-router';

const TargetAppsVersionQuery = graphql(`
  query TargetAppsVersionQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $appName: String!
    $appVersion: String!
    $first: Int
    $after: String
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
        isAppDeploymentsEnabled
      }
    }
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      appDeployment(appName: $appName, appVersion: $appVersion) {
        id
        name
        version
        documents(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              hash
              body
              operationName
              insightsHash
            }
          }
        }
      }
    }
  }
`);

export function TargetAppVersionPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  appName: string;
  appVersion: string;
}) {
  const [data] = useQuery({
    query: TargetAppsVersionQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      appName: props.appName,
      appVersion: props.appVersion,
      first: 20,
      after: null,
    },
  });
  const router = useRouter();
  const client = useClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isAppDeploymentsEnabled =
    !data.fetching && !data.stale && !data.data?.organization?.organization.isAppDeploymentsEnabled;

  useEffect(() => {
    if (isAppDeploymentsEnabled) {
      void router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug',
        params: {
          organizationSlug: props.organizationSlug,
          projectSlug: props.projectSlug,
          targetSlug: props.targetSlug,
        },
        replace: true,
      });
    }
  }, [isAppDeploymentsEnabled]);

  const title = data.data?.target?.appDeployment
    ? `${data.data.target.appDeployment.name}@${data.data.target.appDeployment.version}`
    : 'App Deployment';

  if (!data.fetching && !data.stale && !data?.data?.target?.appDeployment) {
    return (
      <>
        <Meta title="App Version Not found" />
        <TargetLayout
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          page={Page.Apps}
          className="min-h-content"
        >
          <div className="flex h-full flex-1 flex-col items-center justify-center gap-2.5 py-6">
            <img
              src={ghost}
              alt="Ghost illustration"
              width="200"
              height="200"
              className="drag-none"
            />
            <h2 className="text-xl font-bold">App Version not found.</h2>
            <h3 className="font-semibold">This app does not seem to exist anymore.</h3>
            <Button variant="secondary" className="mt-2" onClick={router.history.back}>
              Go back
            </Button>
          </div>
        </TargetLayout>
      </>
    );
  }

  return (
    <>
      <Meta title={title} />
      <TargetLayout
        targetSlug={props.targetSlug}
        projectSlug={props.projectSlug}
        organizationSlug={props.organizationSlug}
        page={Page.Apps}
        className="min-h-content"
      >
        <div className="flex h-full flex-1 flex-col py-6">
          <SubPageLayoutHeader
            subPageTitle={
              <span className="flex items-center">
                <Link
                  to="/$organizationSlug/$projectSlug/$targetSlug/apps"
                  params={{
                    organizationSlug: props.organizationSlug,
                    projectSlug: props.projectSlug,
                    targetSlug: props.targetSlug,
                  }}
                >
                  App Deployments
                </Link>{' '}
                <span className="inline-block px-2 italic text-gray-500">/</span>{' '}
                {data.data?.target?.appDeployment ? (
                  `${data.data.target.appDeployment.name}@${data.data.target.appDeployment.version}`
                ) : (
                  <Skeleton className="inline-block h-5 w-[150px]" />
                )}
              </span>
            }
            description={
              <>
                <CardDescription>
                  Group your GraphQL operations by app version for app version statistics and
                  persisted operations.
                </CardDescription>
                {/* <CardDescription>
                  <DocsLink
                    href="/management/targets#cdn-access-tokens"
                    className="text-gray-500 hover:text-gray-300"
                  >
                    Learn more about App Deployments
                  </DocsLink>
                </CardDescription> */}
              </>
            }
          />
          <div className="mt-4" />
          {data.fetching || data.stale ? (
            <div className="flex h-fit flex-1 items-center justify-center">
              <div className="flex flex-col items-center">
                <Spinner />
                <div className="mt-2 text-xs">Loading app deployments</div>
              </div>
            </div>
          ) : !data.data?.target?.appDeployment?.documents?.edges.length ? (
            <EmptyList
              title="No documents have been uploaded for this app deployment"
              description="You can upload documents via the Hive CLI"
              docsUrl="/features/schema-registry#app-deplyments"
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell">Document Hash</TableHead>
                      <TableHead className="hidden sm:table-cell">Operation Name</TableHead>
                      <TableHead className="hidden text-end sm:table-cell">
                        Document Content
                      </TableHead>
                      <TableHead className="hidden sm:table-cell" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data?.target?.appDeployment.documents?.edges.map(edge => (
                      <TableRow>
                        <TableCell>
                          <span className="rounded bg-gray-800 p-1 font-mono text-sm">
                            {edge.node.hash}
                          </span>
                        </TableCell>
                        <TableCell>
                          {!edge.node.operationName ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help italic">anonymous</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>The operation within the document has no name.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="rounded bg-gray-800 p-1 font-mono text-xs">
                              {edge.node.operationName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <span className="rounded bg-gray-800 p-1 font-mono text-xs">
                            {edge.node.body.length > 43
                              ? edge.node.body.substring(0, 43).replace(/\n/g, '\\n') + '...'
                              : edge.node.body}
                          </span>
                        </TableCell>
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost">
                                <DotsHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link
                                  to="/$organizationSlug/$projectSlug/$targetSlug/laboratory"
                                  params={{
                                    organizationSlug: props.organizationSlug,
                                    projectSlug: props.projectSlug,
                                    targetSlug: props.targetSlug,
                                  }}
                                  search={{
                                    operationString: edge.node.body,
                                  }}
                                >
                                  Open in Laboratory
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link
                                  to="/$organizationSlug/$projectSlug/$targetSlug/insights/$operationName/$operationHash"
                                  params={{
                                    organizationSlug: props.organizationSlug,
                                    projectSlug: props.projectSlug,
                                    targetSlug: props.targetSlug,
                                    operationName: edge.node.operationName ?? edge.node.hash,
                                    operationHash: edge.node.insightsHash,
                                  }}
                                >
                                  Show Insights
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto mr-0 flex"
                  disabled={
                    !data?.data?.target?.appDeployment?.documents?.pageInfo?.hasNextPage ||
                    isLoadingMore
                  }
                  onClick={() => {
                    if (
                      data?.data?.target?.appDeployment?.documents?.pageInfo?.endCursor &&
                      data?.data?.target?.appDeployment?.documents?.pageInfo?.hasNextPage
                    ) {
                      setIsLoadingMore(true);
                      void client
                        .query(TargetAppsVersionQuery, {
                          organizationSlug: props.organizationSlug,
                          projectSlug: props.projectSlug,
                          targetSlug: props.targetSlug,
                          appName: props.appName,
                          appVersion: props.appVersion,
                          first: 20,
                          after: data?.data?.target?.appDeployment?.documents.pageInfo?.endCursor,
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
                      <LoaderCircleIcon className="mr-2 inline size-4 animate-spin" /> Loading
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </TargetLayout>
    </>
  );
}
