import { ReactElement, ReactNode, useEffect } from 'react';
import NextLink from 'next/link';
import { useQuery } from 'urql';

import {
  Button,
  DropdownMenu,
  Header,
  Heading,
  Link,
  Tabs,
} from '@/components/v2';
import { ArrowDownIcon } from '@/components/v2/icon';
import { ProjectDocument, TargetsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

enum TabValue {
  Schema = 'schema',
  Operations = 'operations',
  Laboratory = 'laboratory',
  Settings = 'settings',
}

export const TargetLayout = ({
  children,
  value,
  className,
}: {
  children: ReactNode;
  value: 'schema' | 'operations' | 'laboratory' | 'settings';
  className?: string;
}): ReactElement => {
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

  const targets = targetsQuery.data?.targets;
  const target = targets?.nodes.find((node) => node.cleanId === targetId);

  useEffect(() => {
    if (!targetsQuery.fetching && !target) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [router, target, targetsQuery.fetching]);

  const org = projectQuery.data?.organization.organization;
  const project = projectQuery.data?.project;

  return (
    <>
      <Header>
        {org && project && (
          <div className="wrapper flex items-center text-xs font-medium text-gray-500">
            <NextLink href={`/${orgId}`} passHref>
              <Link className="line-clamp-1 max-w-[250px]">{org.name}</Link>
            </NextLink>
            <ArrowDownIcon className="mx-1 h-4 w-4 -rotate-90 stroke-[1px]" />
            <NextLink href={`/${orgId}/${projectId}`} passHref>
              <Link className="line-clamp-1 max-w-[250px]">{project.name}</Link>
            </NextLink>
          </div>
        )}
        <div className="wrapper">
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
                    (node) =>
                      node.cleanId !== targetId && (
                        <DropdownMenu.Item key={node.cleanId}>
                          <NextLink
                            href={`/${orgId}/${projectId}/${node.cleanId}`}
                          >
                            <a className="line-clamp-1 max-w-2xl">
                              {node.name}
                            </a>
                          </NextLink>
                        </DropdownMenu.Item>
                      )
                  )}
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          </div>
          <div className="mb-10 text-xs font-bold text-[#34eab9]">
            {project?.type}
          </div>
        </div>
      </Header>
      <Tabs className="wrapper" value={value}>
        <Tabs.List>
          <NextLink passHref href={`/${orgId}/${projectId}/${targetId}`}>
            <Tabs.Trigger value={TabValue.Schema} asChild>
              <a>Schema</a>
            </Tabs.Trigger>
          </NextLink>
          <NextLink
            passHref
            href={`/${orgId}/${projectId}/${targetId}/operations`}
          >
            <Tabs.Trigger value={TabValue.Operations} asChild>
              <a>Operations</a>
            </Tabs.Trigger>
          </NextLink>
          <NextLink
            passHref
            href={`/${orgId}/${projectId}/${targetId}/laboratory`}
          >
            <Tabs.Trigger value={TabValue.Laboratory} asChild>
              <a>Laboratory</a>
            </Tabs.Trigger>
          </NextLink>
          <NextLink
            passHref
            href={`/${orgId}/${projectId}/${targetId}/settings`}
          >
            <Tabs.Trigger value={TabValue.Settings} asChild>
              <a>Settings</a>
            </Tabs.Trigger>
          </NextLink>
        </Tabs.List>
        <Tabs.Content value={value} className={className}>
          {children}
        </Tabs.Content>
      </Tabs>
    </>
  );
};
