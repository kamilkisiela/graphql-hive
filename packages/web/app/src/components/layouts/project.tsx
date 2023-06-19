import { ReactElement, ReactNode } from 'react';
import NextLink from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { UserMenu } from '@/components/ui/user-menu';
import { HiveLink, Tabs } from '@/components/v2';
import { PlusIcon } from '@/components/v2/icon';
import { CreateTargetModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { ProjectMigrationToast } from '../project/migration-toast';

enum TabValue {
  Targets = 'targets',
  Alerts = 'alerts',
  Policy = 'policy',
  Settings = 'settings',
}

const ProjectLayout_CurrentOrganizationFragment = graphql(`
  fragment ProjectLayout_CurrentOrganizationFragment on Organization {
    id
    name
    cleanId
    me {
      ...CanAccessProject_MemberFragment
    }
    ...UserMenu_CurrentOrganizationFragment
    projects {
      ...ProjectLayout_ProjectConnectionFragment
    }
  }
`);

const ProjectLayout_MeFragment = graphql(`
  fragment ProjectLayout_MeFragment on User {
    id
    ...UserMenu_MeFragment
  }
`);

const ProjectLayout_OrganizationConnectionFragment = graphql(`
  fragment ProjectLayout_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      cleanId
      name
    }
    ...UserMenu_OrganizationConnectionFragment
  }
`);

const ProjectLayout_CurrentProjectFragment = graphql(`
  fragment ProjectLayout_CurrentProjectFragment on Project {
    id
    cleanId
    name
    registryModel
  }
`);

const ProjectLayout_ProjectConnectionFragment = graphql(`
  fragment ProjectLayout_ProjectConnectionFragment on ProjectConnection {
    nodes {
      id
      cleanId
      name
    }
  }
`);

export function ProjectLayout({
  children,
  value,
  className,
  ...props
}: {
  value: 'targets' | 'alerts' | 'settings' | 'policy';
  className?: string;
  me: FragmentType<typeof ProjectLayout_MeFragment> | null;
  currentOrganization: FragmentType<typeof ProjectLayout_CurrentOrganizationFragment> | null;
  currentProject: FragmentType<typeof ProjectLayout_CurrentProjectFragment> | null;
  organizations: FragmentType<typeof ProjectLayout_OrganizationConnectionFragment> | null;
  children: ReactNode;
}): ReactElement | null {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const { organizationId: orgId, projectId } = router;

  const currentOrganization = useFragment(
    ProjectLayout_CurrentOrganizationFragment,
    props.currentOrganization,
  );
  const currentProject = useFragment(ProjectLayout_CurrentProjectFragment, props.currentProject);

  useProjectAccess({
    scope: ProjectAccessScope.Read,
    member: currentOrganization?.me ?? null,
    redirect: true,
  });

  const me = useFragment(ProjectLayout_MeFragment, props.me);
  const organizationConnection = useFragment(
    ProjectLayout_OrganizationConnectionFragment,
    props.organizations,
  );
  const projectConnection = useFragment(
    ProjectLayout_ProjectConnectionFragment,
    currentOrganization?.projects ?? null,
  );
  const projects = projectConnection?.nodes;

  return (
    <>
      <header>
        <div className="container flex h-[84px] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="w-8 h-8" />
            {currentOrganization ? (
              <NextLink href={`/${orgId}`} className="shrink-0 font-medium truncate max-w-[200px]">
                {currentOrganization.name}
              </NextLink>
            ) : (
              <div className="w-48 max-w-[200px] h-5 bg-gray-800 rounded-full animate-pulse" />
            )}
            {projects?.length && currentProject ? (
              <>
                <div className="text-gray-500 italic">/</div>
                <Select
                  defaultValue={currentProject.cleanId}
                  onValueChange={id => {
                    router.visitProject({
                      organizationId: orgId,
                      projectId: id,
                    });
                  }}
                >
                  <SelectTrigger variant="default">
                    <div className="font-medium">{currentProject.name}</div>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.cleanId} value={project.cleanId}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="w-48 h-5 bg-gray-800 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <UserMenu
              me={me ?? null}
              currentOrganization={currentOrganization ?? null}
              organizations={organizationConnection ?? null}
            />
          </div>
        </div>
      </header>

      {value === 'settings' || currentProject?.registryModel !== 'LEGACY' ? null : (
        <ProjectMigrationToast orgId={orgId} projectId={projectId} />
      )}
      <div className="relative border-b border-gray-800">
        <div className="container flex justify-between items-center">
          {currentOrganization ? (
            <Tabs value={value}>
              <Tabs.List>
                <Tabs.Trigger value={TabValue.Targets} asChild>
                  <NextLink href={`/${orgId}/${projectId}`}>Targets</NextLink>
                </Tabs.Trigger>
                {canAccessProject(ProjectAccessScope.Alerts, currentOrganization.me) && (
                  <Tabs.Trigger value={TabValue.Alerts} asChild>
                    <NextLink href={`/${orgId}/${projectId}/view/${TabValue.Alerts}`}>
                      Alerts
                    </NextLink>
                  </Tabs.Trigger>
                )}
                {canAccessProject(ProjectAccessScope.Settings, currentOrganization.me) && (
                  <>
                    <Tabs.Trigger value={TabValue.Policy} asChild>
                      <NextLink href={`/${orgId}/${projectId}/view/${TabValue.Policy}`}>
                        Policy
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={TabValue.Settings} asChild>
                      <NextLink href={`/${orgId}/${projectId}/view/${TabValue.Settings}`}>
                        Settings
                      </NextLink>
                    </Tabs.Trigger>
                  </>
                )}
              </Tabs.List>
            </Tabs>
          ) : (
            <div className="flex flex-row gap-x-8 px-4 py-3 border-b-[2px] border-b-transparent">
              <div className="w-12 h-5 bg-gray-800 rounded-full animate-pulse" />
              <div className="w-12 h-5 bg-gray-800 rounded-full animate-pulse" />
              <div className="w-12 h-5 bg-gray-800 rounded-full animate-pulse" />
            </div>
          )}
          {currentProject ? (
            <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
              <PlusIcon size={16} className="mr-2" />
              New target
            </Button>
          ) : null}
          <CreateTargetModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
        </div>
      </div>
      <div className="container pb-7 h-full">
        <div className={className}>{children}</div>
      </div>
    </>
  );
}
