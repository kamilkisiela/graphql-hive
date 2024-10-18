import { ReactElement, useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { BadgeRounded } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { noSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { TimeAgo } from '@/components/ui/time-ago';
import { graphql } from '@/gql';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Link, Outlet, useParams, useRouter } from '@tanstack/react-router';

const HistoryPage_VersionsPageQuery = graphql(`
  query HistoryPage_VersionsPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $first: Int!
    $after: String
  ) {
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      schemaVersions(first: $first, after: $after) {
        edges {
          node {
            id
            date
            valid
            log {
              ... on PushedSchemaLog {
                id
                author
                service
                commit
              }
              ... on DeletedSchemaLog {
                id
                deletedService
              }
            }
            baseSchema
            githubMetadata {
              repository
              commit
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`);

// URQL's Infinite scrolling pattern
// https://formidable.com/open-source/urql/docs/basics/ui-patterns/#infinite-scrolling
function ListPage(props: {
  variables: { after: string | null; first: number };
  isLastPage: boolean;
  onLoadMore: (after: string) => void;
  versionId?: string;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement {
  const { variables, isLastPage, onLoadMore, versionId } = props;
  const [versionsQuery] = useQuery({
    query: HistoryPage_VersionsPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      ...variables,
    },
    requestPolicy: 'cache-and-network',
  });

  const edges = versionsQuery.data?.target?.schemaVersions.edges;
  const hasMore = versionsQuery.data?.target?.schemaVersions?.pageInfo?.hasNextPage ?? false;

  return (
    <>
      {edges?.map(({ node: version }) => (
        <div
          key={version.id}
          className={cn(
            'flex flex-col rounded-md p-2.5 hover:bg-gray-800/40',
            versionId === version.id && 'bg-gray-800/40',
          )}
        >
          <Link
            key={version.id}
            to="/$organizationSlug/$projectSlug/$targetSlug/history/$versionId"
            params={{
              organizationSlug: props.organizationSlug,
              projectSlug: props.projectSlug,
              targetSlug: props.targetSlug,
              versionId: version.id,
            }}
          >
            <h3 className="truncate text-sm font-semibold">
              {'commit' in version.log
                ? version.log.commit
                : `Deleted ${version.log.deletedService}`}
            </h3>
            {'author' in version.log ? (
              <div className="truncate text-xs font-medium text-gray-500">
                <span className="overflow-hidden truncate">{version.log.author}</span>
              </div>
            ) : null}
            <div className="mb-1.5 mt-2.5 flex align-middle text-xs font-medium text-[#c4c4c4]">
              <div
                className={cn(!version.valid && 'text-red-500', 'flex flex-row items-center gap-1')}
              >
                <BadgeRounded color={version.valid ? 'green' : 'red'} /> Published
                <TimeAgo date={version.date} />
              </div>

              {'service' in version.log && version.log.service ? (
                <div className="ml-auto mr-0 w-1/2 truncate text-right font-bold">
                  {version.log.service}
                </div>
              ) : null}
            </div>
          </Link>
          {version.githubMetadata ? (
            <a
              className="-ml-px text-xs font-medium text-gray-500 hover:text-gray-400"
              target="_blank"
              rel="noreferrer"
              href={`https://github.com/${version.githubMetadata.repository}/commit/${version.githubMetadata.commit}`}
            >
              <ExternalLinkIcon className="inline" /> associated with Git commit
            </a>
          ) : null}
        </div>
      ))}
      {isLastPage && hasMore && (
        <Button
          variant="link"
          onClick={() => {
            const endCursor = versionsQuery.data?.target?.schemaVersions?.pageInfo?.endCursor;
            if (endCursor) {
              onLoadMore(endCursor);
            }
          }}
        >
          Load more
        </Button>
      )}
    </>
  );
}

const TargetHistoryPageQuery = graphql(`
  query TargetHistoryPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      latestSchemaVersion {
        id
      }
    }
  }
`);

function HistoryPageContent(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const router = useRouter();
  const [query] = useQuery({
    query: TargetHistoryPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
    },
  });
  const [pageVariables, setPageVariables] = useState([{ first: 10, after: null as string | null }]);
  const currentTarget = query.data?.target;
  const hasVersions = !!currentTarget?.latestSchemaVersion?.id;

  const { versionId } = useParams({
    strict: false /* allows to read the $versionId param of its child route */,
  }) as { versionId?: string };

  useEffect(() => {
    if (!versionId && currentTarget?.latestSchemaVersion?.id) {
      void router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug/history/$versionId',
        params: {
          organizationSlug: props.organizationSlug,
          projectSlug: props.projectSlug,
          targetSlug: props.targetSlug,
          versionId: currentTarget.latestSchemaVersion.id,
        },
      });
    }
  }, [versionId, currentTarget?.latestSchemaVersion?.id]);

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  return (
    <TargetLayout
      organizationSlug={props.organizationSlug}
      projectSlug={props.projectSlug}
      targetSlug={props.targetSlug}
      page={Page.History}
      className="flex flex-row gap-x-6"
    >
      {hasVersions ? (
        <>
          <div>
            <div className="py-6">
              <Title>Versions</Title>
              <Subtitle>Recently published schemas.</Subtitle>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex min-w-[420px] grow flex-col gap-2.5 overflow-y-auto rounded-md border border-gray-800/50 bg-gray-900/50 p-2.5">
                {pageVariables.map((variables, i) => (
                  <ListPage
                    key={variables.after || 'initial'}
                    variables={variables}
                    isLastPage={i === pageVariables.length - 1}
                    onLoadMore={after => {
                      setPageVariables([...pageVariables, { after, first: 10 }]);
                    }}
                    versionId={versionId}
                    organizationSlug={props.organizationSlug}
                    projectSlug={props.projectSlug}
                    targetSlug={props.targetSlug}
                  />
                ))}
              </div>
            </div>
          </div>
          <Outlet />
        </>
      ) : (
        <div className="w-full">
          <div className="py-6">
            <Title>Versions</Title>
            <Subtitle>Recently published schemas.</Subtitle>
          </div>
          {query.fetching ? null : noSchemaVersion}
        </div>
      )}
    </TargetLayout>
  );
}

export function TargetHistoryPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  return (
    <>
      <Meta title="History" />
      <HistoryPageContent {...props} />
    </>
  );
}
