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

export enum Page {
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
  page,
  className,
  ...props
}: {
  page: Page;
  className?: string;
  me: FragmentType<typeof ProjectLayout_MeFragment> | null;
  currentOrganization: FragmentType<typeof ProjectLayout_CurrentOrganizationFragment> | null;
  currentProject: FragmentType<typeof ProjectLayout_CurrentProjectFragment> | null;
  organizations: FragmentType<typeof ProjectLayout_OrganizationConnectionFragment> | null;
  children: ReactNode;
}): ReactElement | null {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const { organizationId: orgId } = router;

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
            <HiveLink className="h-8 w-8" />
            {currentOrganization ? (
              <NextLink
                href={{
                  pathname: '/[organizationId]',
                  query: { organizationId: currentOrganization.cleanId },
                }}
                className="max-w-[200px] shrink-0 truncate font-medium"
              >
                {currentOrganization.name}
              </NextLink>
            ) : (
              <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
            )}
            {projects?.length && currentProject ? (
              <>
                <div className="italic text-gray-500">/</div>
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
              <div className="h-5 w-48 animate-pulse rounded-full bg-gray-800" />
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

      {page === Page.Settings || currentProject?.registryModel !== 'LEGACY' ? null : (
        <ProjectMigrationToast orgId={orgId} projectId={currentProject.cleanId} />
      )}

      <div className="relative border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && currentProject ? (
            <Tabs value={page}>
              <Tabs.List>
                <Tabs.Trigger value={Page.Targets} asChild>
                  <NextLink
                    href={{
                      pathname: '/[organizationId]/[projectId]',
                      query: {
                        organizationId: currentOrganization.cleanId,
                        projectId: currentProject.cleanId,
                      },
                    }}
                  >
                    Targets
                  </NextLink>
                </Tabs.Trigger>
                {canAccessProject(ProjectAccessScope.Alerts, currentOrganization.me) && (
                  <Tabs.Trigger value={Page.Alerts} asChild>
                    <NextLink
                      href={{
                        pathname: `/[organizationId]/[projectId]/view/${Page.Alerts}`,
                        query: {
                          organizationId: currentOrganization.cleanId,
                          projectId: currentProject.cleanId,
                        },
                      }}
                    >
                      Alerts
                    </NextLink>
                  </Tabs.Trigger>
                )}
                {canAccessProject(ProjectAccessScope.Settings, currentOrganization.me) && (
                  <>
                    <Tabs.Trigger value={Page.Policy} asChild>
                      <NextLink
                        href={{
                          pathname: `/[organizationId]/[projectId]/view/${Page.Policy}`,
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                          },
                        }}
                      >
                        Policy
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Settings} asChild>
                      <NextLink
                        href={{
                          pathname: `/[organizationId]/[projectId]/view/${Page.Settings}`,
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                          },
                        }}
                      >
                        Settings
                      </NextLink>
                    </Tabs.Trigger>
                  </>
                )}
              </Tabs.List>
            </Tabs>
          ) : (
            <div className="flex flex-row gap-x-8 border-b-[2px] border-b-transparent px-4 py-3">
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
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
      <div className="container h-full pb-7">
        <div className={className}>{children}</div>
      </div>
    </>
  );
}
