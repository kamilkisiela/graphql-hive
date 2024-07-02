import { ReactElement, ReactNode } from 'react';
import { LinkIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import { ConnectSchemaModal } from '@/components/ui/modal/connect-schema';
import { UserMenu } from '@/components/ui/user-menu';
import { HiveLink } from '@/components/v2/hive-link';
import { Tabs } from '@/components/v2/tabs';
import { graphql } from '@/gql';
import { canAccessTarget, TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { ProjectMigrationToast } from '../project/migration-toast';
import { TargetSelector } from './target-selector';

export enum Page {
  Schema = 'schema',
  Explorer = 'explorer',
  Checks = 'checks',
  History = 'history',
  Insights = 'insights',
  Laboratory = 'laboratory',
  Settings = 'settings',
}

const TargetLayoutQuery = graphql(`
  query TargetLayoutQuery {
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
          ...CanAccessTarget_MemberFragment
        }
        projects {
          nodes {
            id
            cleanId
            name
            registryModel
            targets {
              nodes {
                id
                cleanId
                name
              }
            }
          }
        }
      }
      ...TargetSelector_OrganizationConnectionFragment
      ...UserMenu_OrganizationConnectionFragment
    }
    isCDNEnabled
  }
`);

export const TargetLayout = ({
  children,
  connect,
  page,
  className,
  ...props
}: {
  page: Page;
  organizationId: string;
  projectId: string;
  targetId: string;
  className?: string;
  children: ReactNode;
  connect?: ReactNode;
}): ReactElement | null => {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: TargetLayoutQuery,
    requestPolicy: 'cache-first',
  });

  const { organizationId: orgId, projectId } = props;

  const me = query.data?.me;
  const currentOrganization = query.data?.organizations.nodes.find(
    node => node.cleanId === props.organizationId,
  );
  const currentProject = currentOrganization?.projects.nodes.find(
    node => node.cleanId === props.projectId,
  );
  const currentTarget = currentProject?.targets.nodes.find(node => node.cleanId === props.targetId);
  const isCDNEnabled = query.data?.isCDNEnabled === true;

  useTargetAccess({
    scope: TargetAccessScope.Read,
    member: currentOrganization?.me ?? null,
    redirect: true,
    targetId: props.targetId,
    projectId,
    organizationId: orgId,
  });

  useLastVisitedOrganizationWriter(currentOrganization?.cleanId);

  const canAccessSchema = canAccessTarget(
    TargetAccessScope.RegistryRead,
    currentOrganization?.me ?? null,
  );
  const canAccessSettings = canAccessTarget(
    TargetAccessScope.Settings,
    currentOrganization?.me ?? null,
  );

  return (
    <>
      <header>
        <div className="container flex h-[--header-height] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="size-8" />
            <TargetSelector
              organizations={query.data?.organizations ?? null}
              currentOrganizationCleanId={props.organizationId}
              currentProjectCleanId={props.projectId}
              currentTargetCleanId={props.targetId}
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

      {currentProject?.registryModel === 'LEGACY' ? (
        <ProjectMigrationToast orgId={orgId} projectId={projectId} />
      ) : null}

      <div className="relative h-[--tabs-navbar-height] border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && currentProject && currentTarget ? (
            <Tabs className="flex h-full grow flex-col" value={page}>
              <Tabs.List>
                {canAccessSchema && (
                  <>
                    <Tabs.Trigger value={Page.Schema} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Schema
                      </Link>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Checks} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/checks"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Checks
                      </Link>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Explorer} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/explorer"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Explorer
                      </Link>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.History} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/history"
                        params={{
                          organizationId: currentOrganization.cleanId,
                          projectId: currentProject.cleanId,
                          targetId: currentTarget.cleanId,
                        }}
                      >
                        History
                      </Link>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Insights} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/insights"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Insights
                      </Link>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Laboratory} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/laboratory"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Laboratory
                      </Link>
                    </Tabs.Trigger>
                  </>
                )}
                {canAccessSettings && (
                  <Tabs.Trigger value={Page.Settings} asChild>
                    <Link
                      to="/$organizationId/$projectId/$targetId/settings"
                      params={{
                        organizationId: props.organizationId,
                        projectId: props.projectId,
                        targetId: props.targetId,
                      }}
                      search={{ page: 'general' }}
                    >
                      Settings
                    </Link>
                  </Tabs.Trigger>
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
          {currentTarget ? (
            connect != null ? (
              connect
            ) : isCDNEnabled ? (
              <>
                <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
                  <LinkIcon size={16} className="mr-2" />
                  Connect to CDN
                </Button>
                <ConnectSchemaModal
                  organizationId={props.organizationId}
                  projectId={props.projectId}
                  targetId={props.targetId}
                  isOpen={isModalOpen}
                  toggleModalOpen={toggleModalOpen}
                />
              </>
            ) : null
          ) : null}
        </div>
      </div>
      <div className={cn('container pb-7', className)}>{children}</div>
    </>
  );
};
