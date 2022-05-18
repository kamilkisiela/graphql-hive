import { FC, useEffect } from 'react';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
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

const SchemaPage = dynamic(() => import('./schema'));
const OperationsPage = dynamic(() => import('./operations'));
const LaboratoryPage = dynamic(() => import('./laboratory'));
const SettingsPage = dynamic(() => import('./settings'));

enum TabValue {
  Schema = 'schema',
  Operations = 'operations',
  Laboratory = 'laboratory',
  Settings = 'settings',
}

const TargetPage: FC = () => {
  const router = useRouteSelector();
  const { push } = useRouter();

  const [targetsQuery] = useQuery({
    query: TargetsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const [projectQuery] = useQuery({
    query: ProjectDocument,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
    requestPolicy: 'cache-and-network',
  });

  const targets = targetsQuery.data?.targets;
  const target = targets?.nodes.find(
    (node) => node.cleanId === router.targetId
  );

  useEffect(() => {
    if (!targetsQuery.fetching && !target) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [router, target, targetsQuery.fetching]);

  if (!target) return null;

  const org = projectQuery.data?.organization.organization;
  const project = projectQuery.data?.project;
  const hash = router.asPath.replace(/.+#/, '').replace(/\?.*/, '');

  return (
    <>
      <Header>
        {org && project && (
          <div className="wrapper flex items-center text-xs font-medium text-gray-500">
            <NextLink href={`/${router.organizationId}`} passHref>
              <Link className="line-clamp-1 max-w-[250px]">{org.name}</Link>
            </NextLink>
            <ArrowDownIcon className="mx-1 h-4 w-4 -rotate-90 stroke-[1px]" />
            <NextLink
              href={`/${router.organizationId}/${router.projectId}`}
              passHref
            >
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
                      node.cleanId !== router.targetId && (
                        <DropdownMenu.Item key={node.cleanId}>
                          <NextLink
                            href={`/${router.organizationId}/${router.projectId}/${node.cleanId}`}
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
            {project.type}
          </div>
        </div>
      </Header>
      <Tabs
        className="wrapper"
        value={
          Object.values(TabValue).includes(hash as TabValue)
            ? hash
            : TabValue.Schema
        }
        onValueChange={(newValue) => {
          push({
            hash: newValue,
            // in case tab was clicked in /history/[versionId] route
            pathname: `/${router.organizationId}/${router.projectId}/${router.targetId}`,
          });
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value={TabValue.Schema}>Schema</Tabs.Trigger>
          <Tabs.Trigger value={TabValue.Operations}>Operations</Tabs.Trigger>
          <Tabs.Trigger value={TabValue.Laboratory}>Laboratory</Tabs.Trigger>
          <Tabs.Trigger value={TabValue.Settings}>Target Settings</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={TabValue.Schema}>
          <SchemaPage />
        </Tabs.Content>
        <Tabs.Content value={TabValue.Operations}>
          <OperationsPage />
        </Tabs.Content>
        <Tabs.Content value={TabValue.Laboratory}>
          <LaboratoryPage />
        </Tabs.Content>
        <Tabs.Content value={TabValue.Settings}>
          <SettingsPage target={target} organization={org} />
        </Tabs.Content>
      </Tabs>
    </>
  );
};

export default TargetPage;
