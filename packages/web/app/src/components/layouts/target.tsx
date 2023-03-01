import { ReactElement, ReactNode, useEffect } from 'react';
import NextLink from 'next/link';
import { TypedDocumentNode, useQuery } from 'urql';
import { Button, Heading, Link, SubHeader, Tabs } from '@/components/v2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/v2/dropdown';
import { ArrowDownIcon } from '@/components/v2/icon';
import { ConnectSchemaModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { canAccessTarget, TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { Link1Icon } from '@radix-ui/react-icons';
import { QueryError } from '../common/DataWrapper';
import { ProjectMigrationToast } from '../project/migration-toast';

enum TabValue {
  Schema = 'schema',
  Explorer = 'explorer',
  History = 'history',
  Operations = 'operations',
  Laboratory = 'laboratory',
  Settings = 'settings',
}

export const TargetLayout_OrganizationFragment = graphql(`
  fragment TargetLayout_OrganizationFragment on Organization {
    me {
      ...CanAccessTarget_MemberFragment
    }
    name
  }
`);

const TargetLayout_ProjectFragment = graphql(`
  fragment TargetLayout_ProjectFragment on Project {
    type
    name
    registryModel
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

export const TargetLayout = <
  TSatisfies extends {
    organization?:
      | {
          organization?: FragmentType<typeof TargetLayout_OrganizationFragment> | null;
        }
      | null
      | undefined;
    project?: FragmentType<typeof TargetLayout_ProjectFragment> | null;
    targets: FragmentType<typeof TargetLayout_TargetConnectionFragment>;
  } & FragmentType<typeof TargetLayout_IsCDNEnabledFragment>,
>({
  children,
  connect,
  value,
  className,
  query,
}: {
  children(props: TSatisfies): ReactNode;
  value: 'schema' | 'explorer' | 'history' | 'operations' | 'laboratory' | 'settings';
  className?: string;
  connect?: ReactNode;
  query: TypedDocumentNode<
    TSatisfies,
    {
      organizationId: string;
      projectId: string;
      targetId: string;
    }
  >;
}): ReactElement | null => {
  const [isModalOpen, toggleModalOpen] = useToggle();

  const router = useRouteSelector();
  const { organizationId: orgId, projectId, targetId } = router;

  const [data] = useQuery({
    query,
    variables: {
      organizationId: orgId,
      projectId,
      targetId,
    },
    requestPolicy: 'cache-and-network',
  });

  const isCDNEnabled = useFragment(TargetLayout_IsCDNEnabledFragment, data.data);
  const targets = useFragment(TargetLayout_TargetConnectionFragment, data.data?.targets);
  const target = targets?.nodes.find(node => node.cleanId === targetId);
  const org = useFragment(TargetLayout_OrganizationFragment, data.data?.organization?.organization);
  const project = useFragment(TargetLayout_ProjectFragment, data.data?.project);
  const me = org?.me;

  useEffect(() => {
    if (!data.fetching && !target) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [router, target, data.fetching]);

  useEffect(() => {
    if (!data.fetching && !project) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [router, project, data.fetching]);

  useTargetAccess({
    scope: TargetAccessScope.Read,
    member: me ?? null,
    redirect: true,
  });

  const canAccessSchema = canAccessTarget(TargetAccessScope.RegistryRead, me ?? null);
  const canAccessSettings = canAccessTarget(TargetAccessScope.Settings, me ?? null);

  if (data.fetching) {
    return null;
  }

  if (data.error) {
    return <QueryError error={data.error} />;
  }

  if (!org || !project || !target) {
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
                  <DropdownMenuTrigger asChild>
                    <Button size="small">
                      <ArrowDownIcon className="h-5 w-5 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent sideOffset={5} align="end">
                    {targets.nodes.map(
                      node =>
                        node.cleanId !== targetId && (
                          <NextLink
                            key={node.cleanId}
                            href={`/${orgId}/${projectId}/${node.cleanId}`}
                            className="line-clamp-1 max-w-2xl"
                          >
                            <DropdownMenuItem>{node.name}</DropdownMenuItem>
                          </NextLink>
                        ),
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="mb-10 text-xs font-bold text-[#34eab9]">{project?.type}</div>
          </div>
          {connect ??
            (isCDNEnabled?.isCDNEnabled ? (
              <>
                <Button
                  size="large"
                  variant="primary"
                  onClick={toggleModalOpen}
                  className="ml-auto"
                >
                  Connect to CDN
                  <Link1Icon className="ml-8 h-6 w-auto" />
                </Button>
                <ConnectSchemaModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
              </>
            ) : null)}
        </div>
      </SubHeader>

      {project.registryModel === 'LEGACY' ? (
        <ProjectMigrationToast orgId={orgId} projectId={projectId} />
      ) : null}

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
          {children(data.data as TSatisfies)}
        </Tabs.Content>
      </Tabs>
    </>
  );
};
