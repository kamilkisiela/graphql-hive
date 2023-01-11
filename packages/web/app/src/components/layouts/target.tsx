import { ReactElement, ReactNode, useEffect } from 'react';
import NextLink from 'next/link';
import { gql, useQuery } from 'urql';
import { Button, DropdownMenu, Heading, Link, Spinner, SubHeader, Tabs } from '@/components/v2';
import { ArrowDownIcon, Link2Icon } from '@/components/v2/icon';
import { ConnectSchemaModal } from '@/components/v2/modals';
import {
  OrganizationFieldsFragment,
  ProjectDocument,
  ProjectFieldsFragment,
  TargetFieldsFragment,
  TargetsDocument,
} from '@/graphql';
import { canAccessTarget, TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { QueryError } from '../common/DataWrapper';

enum TabValue {
  Schema = 'schema',
  Explorer = 'explorer',
  History = 'history',
  Operations = 'operations',
  Laboratory = 'laboratory',
  Settings = 'settings',
}

const IsCDNEnabledQuery = gql(/* GraphQL */ `
  query IsCDNEnabledQuery {
    isCDNEnabled
  }
`);

export const TargetLayout = ({
  children,
  connect,
  value,
  className,
}: {
  children(props: {
    target: TargetFieldsFragment;
    project: ProjectFieldsFragment;
    organization: OrganizationFieldsFragment;
  }): ReactNode;
  value: 'schema' | 'explorer' | 'history' | 'operations' | 'laboratory' | 'settings';
  className?: string;
  connect?: ReactNode;
}): ReactElement | null => {
  const [isModalOpen, toggleModalOpen] = useToggle();

  const router = useRouteSelector();

  const { organizationId: orgId, projectId, targetId } = router;

  const [targetsQuery] = useQuery({
    query: TargetsDocument,
    variables: {
      selector: {
        organization: orgId,
        project: projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const [projectQuery] = useQuery({
    query: ProjectDocument,
    variables: {
      organizationId: orgId,
      projectId,
    },
    requestPolicy: 'cache-and-network',
  });

  const [isCdnEnabledQuery] = useQuery({ query: IsCDNEnabledQuery });

  const targets = targetsQuery.data?.targets;
  const target = targets?.nodes.find(node => node.cleanId === targetId);
  const org = projectQuery.data?.organization?.organization;
  const project = projectQuery.data?.project;
  const me = org?.me;

  useEffect(() => {
    if (!targetsQuery.fetching && !target) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [router, target, targetsQuery.fetching]);

  useEffect(() => {
    if (!projectQuery.fetching && !project) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [router, project, projectQuery.fetching]);

  useTargetAccess({
    scope: TargetAccessScope.Read,
    member: me,
    redirect: true,
  });

  const canAccessSchema = canAccessTarget(TargetAccessScope.RegistryRead, me);
  const canAccessSettings = canAccessTarget(TargetAccessScope.Settings, me);

  if (projectQuery.fetching || targetsQuery.fetching) {
    return <Spinner className="mt-10" />;
  }

  if (projectQuery.error || targetsQuery.error) {
    return <QueryError error={projectQuery.error || targetsQuery.error} />;
  }

  if (!org || !project || !target) {
    return null;
  }

  if (!isCdnEnabledQuery.data) {
    return null;
  }

  return (
    <>
      <SubHeader>
        <div className="container flex items-center">
          <div>
            <div className="flex items-center text-xs font-medium text-gray-500">
              <Link href={`/${orgId}`} className="line-clamp-1 max-w-[250px]">
                {org.name}
              </Link>
              <ArrowDownIcon className="mx-1 h-4 w-4 -rotate-90 stroke-[1px]" />
              <Link href={`/${orgId}/${projectId}`} className="line-clamp-1 max-w-[250px]">
                {project.name}
              </Link>
            </div>
            <div className="flex items-center gap-2.5">
              <Heading size="2xl" className="line-clamp-1 max-w-2xl">
                {target?.name}
              </Heading>
              {targets && targets.total > 1 && (
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button size="small" rotate={180}>
                      <ArrowDownIcon className="h-5 w-5 text-gray-500" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content sideOffset={5} align="end">
                    {targets.nodes.map(
                      node =>
                        node.cleanId !== targetId && (
                          <NextLink
                            key={node.cleanId}
                            href={`/${orgId}/${projectId}/${node.cleanId}`}
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
            <div className="mb-10 text-xs font-bold text-[#34eab9]">{project?.type}</div>
          </div>
          {connect ??
            (isCdnEnabledQuery.data.isCDNEnabled ? (
              <>
                <Button
                  size="large"
                  variant="primary"
                  onClick={toggleModalOpen}
                  className="ml-auto"
                >
                  Connect
                  <Link2Icon className="ml-8 h-4 w-4" />
                </Button>
                <ConnectSchemaModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
              </>
            ) : null)}
        </div>
      </SubHeader>

      <Tabs className="container flex h-full grow flex-col" value={value}>
        <Tabs.List>
          {canAccessSchema && (
            <>
              <Tabs.Trigger value={TabValue.Schema} asChild>
                <NextLink href={`/${orgId}/${projectId}/${targetId}`}>Schema</NextLink>
              </Tabs.Trigger>
              <Tabs.Trigger value={TabValue.Explorer} asChild>
                <NextLink href={`/${orgId}/${projectId}/${targetId}/explorer`}>Explorer</NextLink>
              </Tabs.Trigger>
              <Tabs.Trigger value={TabValue.History} asChild>
                <NextLink href={`/${orgId}/${projectId}/${targetId}/history`}>History</NextLink>
              </Tabs.Trigger>
              <Tabs.Trigger value={TabValue.Operations} asChild>
                <NextLink href={`/${orgId}/${projectId}/${targetId}/operations`}>
                  Operations
                </NextLink>
              </Tabs.Trigger>
              <Tabs.Trigger value={TabValue.Laboratory} asChild>
                <NextLink href={`/${orgId}/${projectId}/${targetId}/laboratory`}>
                  Laboratory
                </NextLink>
              </Tabs.Trigger>
            </>
          )}
          {canAccessSettings && (
            <Tabs.Trigger value={TabValue.Settings} asChild>
              <NextLink href={`/${orgId}/${projectId}/${targetId}/settings`}>Settings</NextLink>
            </Tabs.Trigger>
          )}
        </Tabs.List>

        <Tabs.Content value={value} className={className}>
          {children({
            target,
            project,
            organization: org,
          })}
        </Tabs.Content>
      </Tabs>
    </>
  );
};
