import { ReactElement } from 'react';
import NextLink from 'next/link';
import { onlyText } from 'react-children-utilities';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts';
import {
  Activities,
  Button,
  Card,
  EmptyList,
  Heading,
  Skeleton,
  TimeAgo,
  Title,
} from '@/components/v2';
import { getActivity } from '@/components/v2/activities';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/v2/dropdown';
import { LinkIcon, MoreIcon, SettingsIcon } from '@/components/v2/icon';
import { FragmentType, graphql, useFragment } from '@/gql';
import { ProjectActivitiesDocument } from '@/graphql';
import { canAccessProject, ProjectAccessScope } from '@/lib/access/project';
import { writeLastVisitedOrganization } from '@/lib/cookies';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { useClipboard } from '@/lib/hooks/use-clipboard';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';

const projectActivitiesDocument = fixDuplicatedFragments(ProjectActivitiesDocument);

const ProjectCard_ProjectFragment = graphql(`
  fragment ProjectCard_ProjectFragment on Project {
    cleanId
    id
    name
  }
`);

const ProjectCard_OrganizationFragment = graphql(`
  fragment ProjectCard_OrganizationFragment on Organization {
    me {
      ...CanAccessProject_MemberFragment
    }
  }
`);

const ProjectCard = (props: {
  project: FragmentType<typeof ProjectCard_ProjectFragment>;
  organization: FragmentType<typeof ProjectCard_OrganizationFragment>;
}): ReactElement | null => {
  const project = useFragment(ProjectCard_ProjectFragment, props.project);
  const organization = useFragment(ProjectCard_OrganizationFragment, props.organization);
  const copyToClipboard = useClipboard();
  const router = useRouteSelector();
  const [projectActivitiesQuery] = useQuery({
    query: projectActivitiesDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: project.cleanId,
        limit: 3,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const href = `/${router.organizationId}/${project.cleanId}`;
  const lastActivity = projectActivitiesQuery.data?.projectActivities.nodes[0];

  return (
    <Card
      as={NextLink}
      key={project.id}
      href={href}
      className="h-full self-start hover:bg-gray-800/40"
    >
      <div className="flex items-start gap-x-2">
        <div className="grow">
          <h4 className="line-clamp-2 text-lg font-bold">{project.name}</h4>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <MoreIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={5} align="start">
            <DropdownMenuItem
              onClick={async e => {
                e.stopPropagation();
                await copyToClipboard(`${location.origin}${href}`);
              }}
            >
              <LinkIcon />
              Share Link
            </DropdownMenuItem>
            {canAccessProject(ProjectAccessScope.Settings, organization.me) && (
              <NextLink href={`/${router.organizationId}/${project.cleanId}/view/settings`}>
                <DropdownMenuItem>
                  <SettingsIcon />
                  Settings
                </DropdownMenuItem>
              </NextLink>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {lastActivity && (
        <div className="mt-5 text-xs font-medium text-gray-500">
          <span className="line-clamp-3">
            {/* fixes Warning: validateDOMNesting(...): <a> cannot appear as a descendant of <a> */}
            {onlyText(getActivity(lastActivity).content)}{' '}
            <TimeAgo date={lastActivity.createdAt} className="text-gray-300" />
          </span>
        </div>
      )}
    </Card>
  );
};

const OrganizationProjectsPageQuery = graphql(`
  query OrganizationProjectsPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationLayout_OrganizationFragment
        ...ProjectCard_OrganizationFragment
      }
    }
    projects(selector: $selector) {
      total
      nodes {
        id
        ...ProjectCard_ProjectFragment
      }
    }
  }
`);

function ProjectsPage(): ReactElement {
  return (
    <>
      <Title title="Projects" />
      <OrganizationLayout
        value="overview"
        className="flex justify-between gap-5"
        query={OrganizationProjectsPageQuery}
      >
        {({ projects, organization }) =>
          projects &&
          organization?.organization && (
            <>
              <div className="grow">
                <Heading className="mb-4">Active Projects</Heading>
                {projects.total === 0 ? (
                  <EmptyList
                    title="Hive is waiting for your first project"
                    description='You can create a project by clicking the "Create Project" button'
                    docsUrl="/management/projects#create-a-new-project"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-5 items-stretch">
                    {/** TODO: use defer here :) */}
                    {projects === null
                      ? [1, 2].map(key => (
                          <Card key={key}>
                            <div className="flex gap-x-2">
                              <Skeleton visible className="h-12 w-12" />
                              <div>
                                <Skeleton visible className="mb-2 h-3 w-16" />
                                <Skeleton visible className="h-3 w-8" />
                              </div>
                            </div>
                            <Skeleton visible className="mt-5 mb-3 h-7 w-1/2" />
                            <Skeleton visible className="h-7" />
                          </Card>
                        ))
                      : projects.nodes.map(project => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            organization={organization.organization}
                          />
                        ))}
                  </div>
                )}
              </div>
              <Activities />
            </>
          )
        }
      </OrganizationLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection(async ({ req, res, resolvedUrl }) => {
  writeLastVisitedOrganization(req, res, resolvedUrl.substring(1));
  return { props: {} };
});

export default authenticated(ProjectsPage);
