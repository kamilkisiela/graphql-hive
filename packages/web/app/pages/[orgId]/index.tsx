import { ReactElement } from 'react';
import NextLink from 'next/link';
import { onlyText } from 'react-children-utilities';
import { useQuery } from 'urql';

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
  AlertsDocument,
  ProjectActivitiesDocument,
  ProjectsWithTargetsDocument,
  ProjectsWithTargetsQuery,
} from '@/graphql';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { useClipboard } from '@/lib/hooks/use-clipboard';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const numberFormatter = Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const projectActivitiesDocument = fixDuplicatedFragments(
  ProjectActivitiesDocument
);

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

  const [alertsQuery] = useQuery({
    query: AlertsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: project.cleanId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const href = `/${router.organizationId}/${project.cleanId}`;
  const lastActivity = projectActivitiesQuery.data?.projectActivities.nodes[0];
  const alerts = alertsQuery.data?.alerts;

  return (
    <NextLink key={project.id} passHref href={href}>
      <Card as="a" className="self-start hover:bg-gray-800/40">
        <div className="flex items-start gap-x-2">
          <div className="grow">
            <h3 className="text-xs font-medium text-[#34EAB9]">
              {project.type}
            </h3>
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
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(`${window.location.origin}${href}`);
                }}
              >
                <LinkIcon />
                Share Link
              </DropdownMenu.Item>
              <NextLink
                href={`/${router.organizationId}/${project.cleanId}#settings`}
              >
                <a>
                  <DropdownMenu.Item>
                    <SettingsIcon />
                    Project Settings
                  </DropdownMenu.Item>
                </a>
              </NextLink>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
        {/*<div className="my-5 flex items-center gap-x-3">*/}
        {/*  <span>*/}
        {/*    <div className="mb-3 text-[1.75rem] font-light">*/}
        {/*      {numberFormatter.format(project.targets.total)}*/}
        {/*    </div>*/}
        {/*    <span className="text-xs font-bold">TARGETS</span>*/}
        {/*  </span>*/}
        {/*  <div className="h-6 w-px bg-gray-800" />*/}
        {/*  <span>*/}
        {/*    <div className="mb-3 text-[1.75rem] font-light">*/}
        {/*      {alerts && numberFormatter.format(alerts.length)}*/}
        {/*    </div>*/}
        {/*    <span className="text-xs font-bold">ALERTS</span>*/}
        {/*  </span>*/}
        {/*</div>*/}
        {lastActivity && (
          <div className="mt-5 text-xs font-medium text-gray-500">
            <span className="line-clamp-3">
              {/* fixes Warning: validateDOMNesting(...): <a> cannot appear as a descendant of <a> */}
              {onlyText(getActivity(lastActivity).content)}{' '}
              <TimeAgo
                date={lastActivity.createdAt}
                className="text-gray-300"
              />
            </span>
          </div>
        )}
      </Card>
    </NextLink>
  );
};

export default function ProjectsPage(): ReactElement {
  const router = useRouteSelector();

  const [projectsWithTargetsQuery] = useQuery({
    query: ProjectsWithTargetsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  const isLoading = projectsWithTargetsQuery.fetching;

  return (
    <OrganizationLayout value="overview" className="flex justify-between gap-5">
      <Title title="Projects" />
      <div className="grow">
        <Heading className="mb-4">Active Projects</Heading>
        {isLoading || projectsWithTargetsQuery.data.projects.total !== 0 ? (
          <div className="grid grid-cols-2 gap-5">
            {isLoading
              ? [1, 2].map((key) => (
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
              : projectsWithTargetsQuery.data.projects.nodes.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
          </div>
        ) : (
          <EmptyList
            title="Hive is waiting for your first project"
            description='You can create a project by clicking the "Create Project" button'
            docsUrl={`${process.env.NEXT_PUBLIC_DOCS_LINK}/get-started/projects`}
          />
        )}
      </div>

      <Activities />
    </OrganizationLayout>
  );
}
