import { FC, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import 'twin.macro';
import { useQuery } from 'urql';

import {
  Button,
  DropdownMenu,
  Header,
  Heading,
  Link,
  Tabs,
} from '@/components/v2';
import { ArrowDownIcon, TargetIcon } from '@/components/v2/icon';
import { CreateTargetModal } from '@/components/v2/modals';
import { ProjectDocument, ProjectsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const AlertsPage = dynamic(() => import('./alerts'));
// const OperationsStorePage = dynamic(() => import('./operations-store'));
const ProjectSettingsPage = dynamic(() => import('./settings'));
const TargetsPage = dynamic(() => import('./targets'));

enum TabValue {
  Targets = 'targets',
  OperationsStore = 'operations-store',
  Alerts = 'alerts',
  Settings = 'settings',
}

const ProjectPage: FC = () => {
  const router = useRouteSelector();
  const { push } = useRouter();
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);

  const [projectQuery] = useQuery({
    query: ProjectDocument,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
  });

  useEffect(() => {
    if (projectQuery.error) {
      // url with # provoke error Maximum update depth exceeded
      router.push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [projectQuery.error, router]);

  const [projectsQuery] = useQuery({
    query: ProjectsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  if (projectQuery.fetching || projectQuery.error) return null;

  const project = projectQuery.data?.project;
  const org = projectQuery.data?.organization.organization;
  const projects = projectsQuery.data?.projects;
  const hash = router.asPath.replace(/.+#/, '').replace(/\?.*/, '');

  return (
    <>
      <Header>
        <div className="wrapper flex items-center pb-4">
          {/*<Avatar src="/images/project-card/logo.svg" tw="w-20 h-20 mr-2.5" />*/}
          <div>
            {org && (
              <NextLink href={`/${router.organizationId}`} passHref>
                <Link className="line-clamp-1 flex max-w-[250px] items-center text-xs font-medium text-gray-500">
                  {org.name}
                </Link>
              </NextLink>
            )}
            <div className="flex items-center gap-2.5">
              <Heading size="2xl" className="line-clamp-1 max-w-2xl">
                {project?.name}
              </Heading>
              {projects && projects.total > 1 && (
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button size="small" rotate={180}>
                      <ArrowDownIcon className="h-5 w-5 text-gray-500" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content sideOffset={5} align="end">
                    {projects.nodes.map(
                      (node) =>
                        node.cleanId !== router.projectId && (
                          <DropdownMenu.Item key={node.cleanId}>
                            <NextLink
                              href={`/${router.organizationId}/${node.cleanId}`}
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
            <span className="text-xs font-bold text-[#34eab9]">
              {project?.type}
            </span>
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
          <CreateTargetModal
            isOpen={isModalOpen}
            toggleModalOpen={toggleModalOpen}
          />
        </div>
      </Header>
      <Tabs
        tw="wrapper"
        value={
          Object.values(TabValue).includes(hash as TabValue)
            ? hash
            : TabValue.Targets
        }
        onValueChange={(newValue) => {
          push({ hash: newValue });
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value={TabValue.Targets}>Targets</Tabs.Trigger>
          {/*<Tabs.Trigger value={TabValue.OperationsStore}>*/}
          {/*  Operations Store*/}
          {/*</Tabs.Trigger>*/}
          <Tabs.Trigger value={TabValue.Alerts}>Alerts</Tabs.Trigger>
          <Tabs.Trigger value={TabValue.Settings}>Settings</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={TabValue.Targets}>
          <TargetsPage />
        </Tabs.Content>
        {/*<Tabs.Content value={TabValue.OperationsStore}>*/}
        {/*  <OperationsStorePage />*/}
        {/*</Tabs.Content>*/}
        <Tabs.Content value={TabValue.Alerts}>
          <AlertsPage />
        </Tabs.Content>
        <Tabs.Content value={TabValue.Settings}>
          <ProjectSettingsPage project={project} />
        </Tabs.Content>
      </Tabs>
    </>
  );
};

export default ProjectPage;
