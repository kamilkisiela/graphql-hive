import { ReactElement, ReactNode, useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import 'twin.macro';
import { useQuery } from 'urql';

import { Button, DropdownMenu, Heading, Link, Tabs, SubHeader } from '@/components/v2';
import { ArrowDownIcon, TargetIcon } from '@/components/v2/icon';
import { CreateTargetModal } from '@/components/v2/modals';
import { ProjectDocument, ProjectsDocument, ProjectFieldsFragment, OrganizationFieldsFragment } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { useProjectAccess, ProjectAccessScope, canAccessProject } from '@/lib/access/project';

enum TabValue {
  Targets = 'targets',
  Alerts = 'alerts',
  Settings = 'settings',
}

export const ProjectLayout = ({
  children,
  value,
  className,
}: {
  children(props: { project: ProjectFieldsFragment; organization: OrganizationFieldsFragment }): ReactNode;
  value: 'targets' | 'alerts' | 'settings';
  className?: string;
}): ReactElement => {
  const router = useRouteSelector();
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen(prevOpen => !prevOpen);
  }, []);

  const { organizationId: orgId, projectId } = router;

  const [projectQuery] = useQuery({
    query: ProjectDocument,
    variables: {
      organizationId: orgId,
      projectId,
    },
  });

  useEffect(() => {
    if (projectQuery.error) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [projectQuery.error, router]);

  const [projectsQuery] = useQuery({
    query: ProjectsDocument,
    variables: {
      selector: {
        organization: orgId,
      },
    },
  });

  useProjectAccess({
    scope: ProjectAccessScope.Read,
    member: projectQuery.data?.organization.organization.me,
    redirect: true,
  });

  if (projectQuery.fetching || projectQuery.error) return null;

  const project = projectQuery.data?.project;
  const org = projectQuery.data?.organization.organization;
  const projects = projectsQuery.data?.projects;
  const me = org.me;

  return (
    <>
      <SubHeader>
        <div className="wrapper flex items-center pb-4">
          <div>
            {org && (
              <NextLink href={`/${orgId}`} passHref>
                <Link className="line-clamp-1 flex max-w-[250px] items-center text-xs font-medium text-gray-500">
                  {org.name}
                </Link>
              </NextLink>
            )}
            <div className="flex items-center gap-2.5">
              <Heading size="2xl" className="line-clamp-1 max-w-2xl">
                {project?.name}
              </Heading>
              {projects && projects.total > 1 && (
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button size="small" rotate={180}>
                      <ArrowDownIcon className="h-5 w-5 text-gray-500" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content sideOffset={5} align="end">
                    {projects.nodes.map(
                      node =>
                        node.cleanId !== projectId && (
                          <DropdownMenu.Item key={node.cleanId}>
                            <NextLink href={`/${orgId}/${node.cleanId}`}>
                              <a className="line-clamp-1 max-w-2xl">{node.name}</a>
                            </NextLink>
                          </DropdownMenu.Item>
                        )
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu>
              )}
            </div>
            <span className="text-xs font-bold text-[#34eab9]">{project?.type}</span>
          </div>
          <Button className="ml-auto shrink-0" variant="primary" size="large" onClick={toggleModalOpen}>
            New Target
            <TargetIcon className="ml-6" />
          </Button>
          <CreateTargetModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
        </div>
      </SubHeader>

      <Tabs className="wrapper" value={value}>
        <Tabs.List>
          <NextLink passHref href={`/${orgId}/${projectId}`}>
            <Tabs.Trigger value={TabValue.Targets} asChild>
              <a>Targets</a>
            </Tabs.Trigger>
          </NextLink>
          {canAccessProject(ProjectAccessScope.Alerts, me) && (
            <NextLink passHref href={`/${orgId}/${projectId}/alerts`}>
              <Tabs.Trigger value={TabValue.Alerts} asChild>
                <a>Alerts</a>
              </Tabs.Trigger>
            </NextLink>
          )}
          {canAccessProject(ProjectAccessScope.Settings, me) && (
            <NextLink passHref href={`/${orgId}/${projectId}/settings`}>
              <Tabs.Trigger value={TabValue.Settings} asChild>
                <a>Settings</a>
              </Tabs.Trigger>
            </NextLink>
          )}
        </Tabs.List>
        <Tabs.Content value={value} className={className}>
          {children({ project, organization: org })}
        </Tabs.Content>
      </Tabs>
    </>
  );
};
