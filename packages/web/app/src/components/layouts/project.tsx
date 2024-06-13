import { ReactElement, ReactNode } from 'react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/ui/user-menu';
import { HiveLink } from '@/components/v2/hive-link';
import { PlusIcon } from '@/components/v2/icon';
import { Tabs } from '@/components/v2/tabs';
import { graphql } from '@/gql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { Link } from '@tanstack/react-router';
import { ProjectMigrationToast } from '../project/migration-toast';
import { CreateTargetModal } from '../ui/modal/create-target';
import { ProjectSelector } from './project-selector';

export enum Page {
  Targets = 'targets',
  Alerts = 'alerts',
  Policy = 'policy',
  Settings = 'settings',
}

const ProjectLayoutQuery = graphql(`
  query ProjectLayoutQuery {
    me {
      id
      ...UserMenu_MeFragment
    }
    organizations {
      nodes {
        id
        cleanId
        name
        me {
          id
          ...CanAccessProject_MemberFragment
        }
        projects {
          nodes {
            id
            cleanId
            name
            registryModel
          }
        }
      }
      ...ProjectSelector_OrganizationConnectionFragment
      ...UserMenu_OrganizationConnectionFragment
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
  organizationId: string;
  projectId: string;
  className?: string;
  children: ReactNode;
}): ReactElement | null {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: ProjectLayoutQuery,
    requestPolicy: 'cache-first',
  });

  const me = query.data?.me;
  const currentOrganization = query.data?.organizations.nodes.find(
    node => node.cleanId === props.organizationId,
  );
  const currentProject = currentOrganization?.projects.nodes.find(
    node => node.cleanId === props.projectId,
  );

  useProjectAccess({
    scope: ProjectAccessScope.Read,
    member: currentOrganization?.me ?? null,
    redirect: true,
    organizationId: props.organizationId,
    projectId: props.projectId,
  });

  useLastVisitedOrganizationWriter(currentOrganization?.cleanId);

  return (
    <>
      <header>
        <div className="container flex h-[--header-height] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="size-8" />
            <ProjectSelector
              currentOrganizationCleanId={props.organizationId}
              currentProjectCleanId={props.projectId}
              organizations={query.data?.organizations ?? null}
            />
          </div>
          <div>
            <UserMenu
              me={me ?? null}
              currentOrganizationCleanId={props.organizationId}
              organizations={query.data?.organizations ?? null}
            />
          </div>
        </div>
      </header>

      {page === Page.Settings || currentProject?.registryModel !== 'LEGACY' ? null : (
        <ProjectMigrationToast orgId={props.organizationId} projectId={currentProject.cleanId} />
      )}

      <div className="relative h-[--tabs-navbar-height] border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && currentProject ? (
            <Tabs value={page}>
              <Tabs.List>
                <Tabs.Trigger value={Page.Targets} asChild>
                  <Link
                    to="/$organizationId/$projectId"
                    params={{
                      organizationId: currentOrganization.cleanId,
                      projectId: currentProject.cleanId,
                    }}
                  >
                    Targets
                  </Link>
                </Tabs.Trigger>
                {canAccessProject(ProjectAccessScope.Alerts, currentOrganization.me) && (
                  <Tabs.Trigger value={Page.Alerts} asChild>
                    <Link
                      to="/$organizationId/$projectId/view/alerts"
                      params={{
                        organizationId: currentOrganization.cleanId,
                        projectId: currentProject.cleanId,
                      }}
                    >
                      Alerts
                    </Link>
                  </Tabs.Trigger>
                )}
                {canAccessProject(ProjectAccessScope.Settings, currentOrganization.me) && (
                  <>
                    <Tabs.Trigger value={Page.Policy} asChild>
                      <Link
                        to="/$organizationId/$projectId/view/policy"
                        params={{
                          organizationId: currentOrganization.cleanId,
                          projectId: currentProject.cleanId,
                        }}
                      >
                        Policy
                      </Link>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Settings} asChild>
                      <Link
                        to="/$organizationId/$projectId/view/settings"
                        params={{
                          organizationId: currentOrganization.cleanId,
                          projectId: currentProject.cleanId,
                        }}
                      >
                        Settings
                      </Link>
                    </Tabs.Trigger>
                  </>
                )}
              </Tabs.List>
            </Tabs>
          ) : (
            <div className="flex flex-row gap-x-8 border-b-2 border-b-transparent px-4 py-3">
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
          <CreateTargetModal
            organizationId={props.organizationId}
            projectId={props.projectId}
            isOpen={isModalOpen}
            toggleModalOpen={toggleModalOpen}
          />
        </div>
      </div>
      <div className="container h-full pb-7">
        <div className={className}>{children}</div>
      </div>
    </>
  );
}
