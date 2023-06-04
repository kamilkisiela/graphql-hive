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
import { ArrowDownIcon, TargetIcon } from '@/components/v2/icon';
import { CreateTargetModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Exact, ProjectsDocument } from '@/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { ProjectMigrationToast } from '../project/migration-toast';

enum TabValue {
  Targets = 'targets',
  Alerts = 'alerts',
  Policy = 'policy',
  Settings = 'settings',
}

const ProjectLayout_OrganizationFragment = graphql(`
  fragment ProjectLayout_OrganizationFragment on Organization {
    name
    me {
      ...CanAccessProject_MemberFragment
    }
  }
`);

const ProjectLayout_ProjectFragment = graphql(`
  fragment ProjectLayout_ProjectFragment on Project {
    name
    type
    registryModel
  }
`);

export function ProjectLayout<
  /**
   *  LOL fire me for this.
   *  Because of this kind of abstraction in place I invented this complicated generic satisfaction thing.
   *  I'm not sure if it's worth it, but it's the only way I could think of to make it work without removing this component.
   */
  TSatisfiesType extends {
    organization?:
      | {
          organization?: FragmentType<typeof ProjectLayout_OrganizationFragment> | null;
        }
      | null
      | undefined;
    project?: FragmentType<typeof ProjectLayout_ProjectFragment> | null;
  },
>({
  children,
  value,
  className,
  query,
}: {
  children(
    props: {
      project: Exclude<TSatisfiesType['project'], null | undefined>;
      organization: Exclude<TSatisfiesType['organization'], null | undefined>;
    },
    selector: {
      organization: string;
      project: string;
    },
  ): ReactNode;
  value: 'targets' | 'alerts' | 'settings' | 'policy';
  className?: string;
  query: TypedDocumentNode<
    TSatisfiesType,
    Exact<{
      organizationId: string;
      projectId: string;
    }>
  >;
}): ReactElement | null {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const { organizationId: orgId, projectId } = router;

  const [projectQuery] = useQuery({
    query,
    variables: {
      organizationId: orgId,
      projectId,
    },
  });

  useEffect(() => {
    if (projectQuery.error) {
      // url with # provoke error Maximum update depth exceeded
      void router.push('/404', router.asPath.replace(/#.*/, ''));
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

  const organization = useFragment(
    ProjectLayout_OrganizationFragment,
    projectQuery.data?.organization?.organization,
  );

  useProjectAccess({
    scope: ProjectAccessScope.Read,
    member: organization?.me ?? null,
    redirect: true,
  });

  if (projectQuery.fetching || projectQuery.error) {
    return null;
  }

  const project = useFragment(ProjectLayout_ProjectFragment, projectQuery.data?.project);
  const projects = projectsQuery.data?.projects;

  if (!organization || !project) {
    return null;
  }

  return (
    <>
      <SubHeader>
        <div className="container flex items-center pb-4">
          <div>
            {organization && (
              <Link
                href={`/${orgId}`}
                className="line-clamp-1 flex max-w-[250px] items-center text-xs font-medium text-gray-500"
              >
                {organization.name}
              </Link>
            )}
            <div className="flex items-center gap-2.5">
              <Heading size="2xl" className="line-clamp-1 max-w-2xl">
                {project?.name}
              </Heading>
              {projects && projects.total > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="small">
                      <ArrowDownIcon className="h-5 w-5 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent sideOffset={5} align="end">
                    {projects.nodes.map(
                      node =>
                        node.cleanId !== projectId && (
                          <NextLink
                            key={node.cleanId}
                            href={`/${orgId}/${node.cleanId}`}
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

      {value === 'settings' || project.registryModel !== 'LEGACY' ? null : (
        <ProjectMigrationToast orgId={orgId} projectId={projectId} />
      )}

      <Tabs className="container" value={value}>
        <Tabs.List>
          <Tabs.Trigger value={TabValue.Targets} asChild>
            <NextLink href={`/${orgId}/${projectId}`}>Targets</NextLink>
          </Tabs.Trigger>
          {canAccessProject(ProjectAccessScope.Alerts, organization.me) && (
            <Tabs.Trigger value={TabValue.Alerts} asChild>
              <NextLink href={`/${orgId}/${projectId}/view/${TabValue.Alerts}`}>Alerts</NextLink>
            </Tabs.Trigger>
          )}
          {canAccessProject(ProjectAccessScope.Settings, organization.me) && (
            <>
              <Tabs.Trigger value={TabValue.Policy} asChild>
                <NextLink href={`/${orgId}/${projectId}/view/${TabValue.Policy}`}>Policy</NextLink>
              </Tabs.Trigger>
              <Tabs.Trigger value={TabValue.Settings} asChild>
                <NextLink href={`/${orgId}/${projectId}/view/${TabValue.Settings}`}>
                  Settings
                </NextLink>
              </Tabs.Trigger>
            </>
          )}
        </Tabs.List>
        <Tabs.Content value={value} className={className}>
          {children(
            {
              project: projectQuery.data?.project as Exclude<
                TSatisfiesType['project'],
                null | undefined
              >,
              organization: projectQuery.data?.organization as Exclude<
                TSatisfiesType['organization'],
                null | undefined
              >,
            },
            {
              organization: orgId,
              project: projectId,
            },
          )}
        </Tabs.Content>
      </Tabs>
    </>
  );
}
