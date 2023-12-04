import { ReactElement, ReactNode } from 'react';
import NextLink from 'next/link';
import { Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { UserMenu } from '@/components/ui/user-menu';
import { HiveLink, Tabs } from '@/components/v2';
import { ConnectSchemaModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { canAccessTarget, TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export enum Page {
  Schema = 'schema',
  Explorer = 'explorer',
  Checks = 'checks',
  History = 'history',
  Insights = 'insights',
  Laboratory = 'laboratory',
  Settings = 'settings',
}

const TargetLayout_CurrentOrganizationFragment = graphql(`
  fragment TargetLayout_CurrentOrganizationFragment on Organization {
    id
    name
    cleanId
    me {
      id
      ...CanAccessTarget_MemberFragment
    }
    ...UserMenu_CurrentOrganizationFragment
    projects {
      ...ProjectLayout_ProjectConnectionFragment
    }
  }
`);

const TargetLayout_MeFragment = graphql(`
  fragment TargetLayout_MeFragment on User {
    id
    ...UserMenu_MeFragment
  }
`);

const TargetLayout_OrganizationConnectionFragment = graphql(`
  fragment TargetLayout_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      cleanId
      name
    }
    ...UserMenu_OrganizationConnectionFragment
  }
`);

const TargetLayout_CurrentProjectFragment = graphql(`
  fragment TargetLayout_CurrentProjectFragment on Project {
    id
    cleanId
    name
    targets {
      ...TargetLayout_TargetConnectionFragment
    }
  }
`);

const TargetLayout_TargetConnectionFragment = graphql(`
  fragment TargetLayout_TargetConnectionFragment on TargetConnection {
    total
    nodes {
      cleanId
      name
    }
  }
`);

const TargetLayout_IsCDNEnabledFragment = graphql(`
  fragment TargetLayout_IsCDNEnabledFragment on Query {
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
  className?: string;
  children: ReactNode;
  connect?: ReactNode;
  me: FragmentType<typeof TargetLayout_MeFragment> | null;
  currentOrganization: FragmentType<typeof TargetLayout_CurrentOrganizationFragment> | null;
  currentProject: FragmentType<typeof TargetLayout_CurrentProjectFragment> | null;
  organizations: FragmentType<typeof TargetLayout_OrganizationConnectionFragment> | null;
  isCDNEnabled: FragmentType<typeof TargetLayout_IsCDNEnabledFragment> | null;
}): ReactElement | null => {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const currentOrganization = useFragment(
    TargetLayout_CurrentOrganizationFragment,
    props.currentOrganization,
  );
  const currentProject = useFragment(TargetLayout_CurrentProjectFragment, props.currentProject);

  const me = useFragment(TargetLayout_MeFragment, props.me);
  const organizationConnection = useFragment(
    TargetLayout_OrganizationConnectionFragment,
    props.organizations,
  );
  const targetConnection = useFragment(
    TargetLayout_TargetConnectionFragment,
    currentProject?.targets,
  );
  const targets = targetConnection?.nodes;
  const currentTarget = targets?.find(target => target.cleanId === router.targetId);
  const isCDNEnabled = useFragment(TargetLayout_IsCDNEnabledFragment, props.isCDNEnabled);

  useTargetAccess({
    scope: TargetAccessScope.Read,
    member: currentOrganization?.me ?? null,
    redirect: true,
  });

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
        <div className="container flex h-[84px] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="h-8 w-8" />
            {currentOrganization ? (
              <NextLink
                href={{
                  pathname: '/[organizationId]',
                  query: {
                    organizationId: currentOrganization.cleanId,
                  },
                }}
                className="max-w-[200px] shrink-0 truncate font-medium"
              >
                {currentOrganization.name}
              </NextLink>
            ) : (
              <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
            )}
            <div className="italic text-gray-500">/</div>
            {currentOrganization && currentProject ? (
              <NextLink
                href={{
                  pathname: '/[organizationId]/[projectId]',
                  query: {
                    organizationId: currentOrganization.cleanId,
                    projectId: currentProject.cleanId,
                  },
                }}
                className="max-w-[200px] shrink-0 truncate font-medium"
              >
                {currentProject.name}
              </NextLink>
            ) : (
              <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
            )}
            <div className="italic text-gray-500">/</div>
            {targets?.length && currentOrganization && currentProject && currentTarget ? (
              <>
                <Select
                  defaultValue={currentTarget.cleanId}
                  onValueChange={id => {
                    router.visitTarget({
                      organizationId: currentOrganization.cleanId,
                      projectId: currentProject.cleanId,
                      targetId: id,
                    });
                  }}
                >
                  <SelectTrigger variant="default">
                    <div className="font-medium">{currentTarget.name}</div>
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map(target => (
                      <SelectItem key={target.cleanId} value={target.cleanId}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
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

      <div className="relative border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && currentProject && currentTarget ? (
            <Tabs className="flex h-full grow flex-col" value={page}>
              <Tabs.List>
                {canAccessSchema && (
                  <>
                    <Tabs.Trigger value={Page.Schema} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/[projectId]/[targetId]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                            targetId: currentTarget.cleanId,
                          },
                        }}
                      >
                        Schema
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Checks} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/[projectId]/[targetId]/checks',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                            targetId: currentTarget.cleanId,
                          },
                        }}
                      >
                        Checks
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Explorer} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/[projectId]/[targetId]/explorer',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                            targetId: currentTarget.cleanId,
                          },
                        }}
                      >
                        Explorer
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.History} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/[projectId]/[targetId]/history',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                            targetId: currentTarget.cleanId,
                          },
                        }}
                      >
                        History
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Insights} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/[projectId]/[targetId]/insights',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                            targetId: currentTarget.cleanId,
                          },
                        }}
                      >
                        Insights
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Laboratory} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/[projectId]/[targetId]/laboratory',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            projectId: currentProject.cleanId,
                            targetId: currentTarget.cleanId,
                          },
                        }}
                      >
                        Laboratory
                      </NextLink>
                    </Tabs.Trigger>
                  </>
                )}
                {canAccessSettings && (
                  <Tabs.Trigger value={Page.Settings} asChild>
                    <NextLink
                      href={{
                        pathname: '/[organizationId]/[projectId]/[targetId]/settings',
                        query: {
                          organizationId: currentOrganization.cleanId,
                          projectId: currentProject.cleanId,
                          targetId: currentTarget.cleanId,
                        },
                      }}
                    >
                      Settings
                    </NextLink>
                  </Tabs.Trigger>
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
          {currentTarget ? (
            // eslint-disable-next-line unicorn/no-negated-condition
            connect != null ? (
              connect
            ) : isCDNEnabled?.isCDNEnabled ? (
              <>
                <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
                  <Link size={16} className="mr-2" />
                  Connect to CDN
                </Button>
                <ConnectSchemaModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
              </>
            ) : null
          ) : null}
        </div>
      </div>
      <div className="container h-full pb-7">
        <div className={cn('flex h-full justify-between gap-12', className)}>
          <div className="flex grow flex-col">{children}</div>
        </div>
      </div>
    </>
  );
};
