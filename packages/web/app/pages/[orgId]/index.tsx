import { FC, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useQuery } from 'urql';

import { Button, Header, Heading, Tabs } from '@/components/v2';
import { PlusIcon } from '@/components/v2/icon';
import { CreateProjectModal } from '@/components/v2/modals';
import { OrganizationDocument, OrganizationType } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const MembersPage = dynamic(() => import('./members'));
const ProjectsPage = dynamic(() => import('./projects'));
const SettingsPage = dynamic(() => import('./settings'));
const SubscriptionPage = dynamic(() => import('./subscription'));

enum TabValue {
  Overview = 'overview',
  Members = 'members',
  Settings = 'settings',
  Subscription = 'subscription',
}

const OrganizationPage: FC = () => {
  const router = useRouteSelector();
  const { push } = useRouter();
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);

  const [organizationQuery] = useQuery({
    query: OrganizationDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  useEffect(() => {
    if (organizationQuery.error) {
      // url with # provoke error Maximum update depth exceeded
      push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [organizationQuery.error, router]);

  if (organizationQuery.fetching || organizationQuery.error) return null;

  const organization = organizationQuery.data?.organization.organization;
  const isRegularOrg =
    !organization || organization.type === OrganizationType.Regular;
  const hash = router.asPath.replace(/.+#/, '');

  return (
    <>
      <Header>
        <header className="wrapper flex h-[84px] items-center justify-between">
          <div>
            <Heading size="2xl" className="line-clamp-1">
              {organization?.name}
            </Heading>
            <div className="text-xs font-medium text-gray-500">
              Organization
            </div>
          </div>
          <Button
            size="large"
            variant="primary"
            className="shrink-0"
            onClick={toggleModalOpen}
          >
            Create Project
            <PlusIcon className="ml-2" />
          </Button>
          <CreateProjectModal
            isOpen={isModalOpen}
            toggleModalOpen={toggleModalOpen}
          />
        </header>
      </Header>
      <Tabs
        className="wrapper"
        value={
          Object.values(TabValue).includes(hash as TabValue)
            ? hash
            : TabValue.Overview
        }
        onValueChange={(newValue) => {
          push({ hash: newValue });
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value={TabValue.Overview}>Overview</Tabs.Trigger>
          {isRegularOrg && (
            <Tabs.Trigger value={TabValue.Members}>Members</Tabs.Trigger>
          )}
          <Tabs.Trigger value={TabValue.Settings}>Settings</Tabs.Trigger>
          <Tabs.Trigger value={TabValue.Subscription}>Subscription</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={TabValue.Overview}>
          <ProjectsPage />
        </Tabs.Content>
        <Tabs.Content value={TabValue.Members} asChild>
          <MembersPage className="w-4/5" />
        </Tabs.Content>
        <Tabs.Content value={TabValue.Settings}>
          <SettingsPage organization={organization} />
        </Tabs.Content>
        <Tabs.Content value={TabValue.Subscription}>
          <SubscriptionPage />
        </Tabs.Content>
      </Tabs>
    </>
  );
};

export default OrganizationPage;
