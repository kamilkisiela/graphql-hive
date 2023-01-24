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
  DropdownMenu,
  EmptyList,
  Heading,
  Skeleton,
  TimeAgo,
  Title,
} from '@/components/v2';
import { getActivity } from '@/components/v2/activities';
import { LinkIcon, MoreIcon, SettingsIcon } from '@/components/v2/icon';
import {
  ProjectActivitiesDocument,
  ProjectsWithTargetsDocument,
  ProjectsWithTargetsQuery,
} from '@/graphql';
import { writeLastVisitedOrganization } from '@/lib/cookies';
import { getDocsUrl } from '@/lib/docs-url';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { useClipboard } from '@/lib/hooks/use-clipboard';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';

const projectActivitiesDocument = fixDuplicatedFragments(ProjectActivitiesDocument);

const ProjectCard = ({
  project,
}: {
  project: ProjectsWithTargetsQuery['projects']['nodes'][number];
}): ReactElement => {
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
    <Card as={NextLink} key={project.id} href={href} className="self-start hover:bg-gray-800/40">
      <div className="flex items-start gap-x-2">
        <div className="grow">
          <h3 className="text-xs font-medium text-[#34EAB9]">{project.type}</h3>
          <h4 className="line-clamp-2 text-lg font-bold">{project.name}</h4>
        </div>

        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button rotate={90}>
              <MoreIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content sideOffset={5} align="start">
            <DropdownMenu.Item
              onClick={async e => {
                e.stopPropagation();
                await copyToClipboard(`${location.origin}${href}`);
              }}
            >
              <LinkIcon />
              Share Link
            </DropdownMenu.Item>
            <NextLink href={`/${router.organizationId}/${project.cleanId}/view/settings`}>
              <DropdownMenu.Item>
                <SettingsIcon />
                Settings
              </DropdownMenu.Item>
            </NextLink>
          </DropdownMenu.Content>
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

function ProjectsPage(): ReactElement {
  const router = useRouteSelector();

  const [projectsWithTargetsQuery] = useQuery({
    query: ProjectsWithTargetsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  return (
    <>
      <Title title="Projects" />
      <OrganizationLayout value="overview" className="flex justify-between gap-5">
        {() => (
          <>
            <div className="grow">
              <Heading className="mb-4">Active Projects</Heading>
              {projectsWithTargetsQuery.data?.projects.total === 0 ? (
                <EmptyList
                  title="Hive is waiting for your first project"
                  description='You can create a project by clicking the "Create Project" button'
                  docsUrl={getDocsUrl(`/get-started/projects`)}
                />
              ) : (
                <div className="grid grid-cols-2 gap-5">
                  {projectsWithTargetsQuery.fetching
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
                    : projectsWithTargetsQuery.data?.projects.nodes.map(project => (
                        <ProjectCard key={project.id} project={project} />
                      ))}
                </div>
              )}
            </div>

            <Activities />
          </>
        )}
      </OrganizationLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection(async ({ req, res, resolvedUrl }) => {
  writeLastVisitedOrganization(req, res, resolvedUrl.substring(1));
  return {
    props: {},
  };
});

export default authenticated(ProjectsPage);
