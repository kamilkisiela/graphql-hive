import { ReactElement, ReactNode, useEffect } from 'react';
import NextLink from 'next/link';
import 'twin.macro';
import { useQuery } from 'urql';
import { Button, DropdownMenu, Heading, Link, SubHeader, Tabs } from '@/components/v2';
import { ArrowDownIcon, TargetIcon } from '@/components/v2/icon';
import { CreateTargetModal } from '@/components/v2/modals';
import {
  OrganizationFieldsFragment,
  ProjectDocument,
  ProjectFieldsFragment,
  ProjectsDocument,
} from '@/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { ProjectMigrationToast } from '../project/migration-toast';

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
  children(props: {
    project: ProjectFieldsFragment;
    organization: OrganizationFieldsFragment;
  }): ReactNode;
  value: 'targets' | 'alerts' | 'settings';
  className?: string;
}): ReactElement | null => {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();

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
    member: projectQuery.data?.organization?.organization.me,
    redirect: true,
  });

  if (projectQuery.fetching || projectQuery.error) {
    return null;
  }

  const project = projectQuery.data?.project;
  const org = projectQuery.data?.organization?.organization;
  const projects = projectsQuery.data?.projects;

  if (!org || !project) {
    return null;
  }

  return (
    <>
      <SubHeader>
        <div className="container flex items-center pb-4">
          <div>
            {org && (
              <Link
                href={`/${orgId}`}
                className="line-clamp-1 flex max-w-[250px] items-center text-xs font-medium text-gray-500"
              >
                {org.name}
              </Link>
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
                          <NextLink
                            key={node.cleanId}
                            href={`/${orgId}/${node.cleanId}`}
                            className="line-clamp-1 max-w-2xl"
                          >
                            <DropdownMenu.Item>{node.name}</DropdownMenu.Item>
                          </NextLink>
                        ),
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu>
              )}
            </div>
            <span className="text-xs font-bold text-[#34eab9]">{project?.type}</span>
          </div>
          <Button
            className="ml-auto shrink-0"
            variant="primary"
            size="large"
            onClick={toggleModalOpen}
          >
            New Target
            <TargetIcon className="ml-6" />
          </Button>
          <CreateTargetModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
        </div>
      </SubHeader>

      {value === 'settings' ? null : <ProjectMigrationToast orgId={orgId} projectId={projectId} />}

      <Tabs className="container" value={value}>
        <Tabs.List>
          <Tabs.Trigger value={TabValue.Targets} asChild>
            <NextLink href={`/${orgId}/${projectId}`}>Targets</NextLink>
          </Tabs.Trigger>
          {canAccessProject(ProjectAccessScope.Alerts, org.me) && (
            <Tabs.Trigger value={TabValue.Alerts} asChild>
              <NextLink href={`/${orgId}/${projectId}/view/alerts`}>Alerts</NextLink>
            </Tabs.Trigger>
          )}
          {canAccessProject(ProjectAccessScope.Settings, org.me) && (
            <Tabs.Trigger value={TabValue.Settings} asChild>
              <NextLink href={`/${orgId}/${projectId}/view/settings`}>Settings</NextLink>
            </Tabs.Trigger>
          )}
        </Tabs.List>
        <Tabs.Content value={value} className={className}>
          {children({ project, organization: org })}
        </Tabs.Content>
      </Tabs>
    </>
  );
};
