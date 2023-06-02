import { ReactElement, useState } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { ProjectLayout } from '@/components/layouts/project';
import { AlertsTable, AlertsTable_AlertFragment } from '@/components/project/alerts/alerts-table';
import {
  ChannelsTable,
  ChannelsTable_AlertChannelFragment,
} from '@/components/project/alerts/channels-table';
import {
  CreateAlertModal,
  CreateAlertModal_AlertChannelFragment,
  CreateAlertModal_TargetFragment,
} from '@/components/project/alerts/create-alert';
import { CreateChannelModal } from '@/components/project/alerts/create-channel';
import { DeleteAlertsButton } from '@/components/project/alerts/delete-alerts-button';
import { DeleteChannelsButton } from '@/components/project/alerts/delete-channels-button';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DocsLink, Title } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { useNotFoundRedirectOnError } from '@/lib/hooks/use-not-found-redirect-on-error';
import { withSessionProtection } from '@/lib/supertokens/guard';

function Channels(props: {
  channels: FragmentType<typeof ChannelsTable_AlertChannelFragment>[];
}): ReactElement {
  const router = useRouteSelector();
  const [selected, setSelected] = useState<string[]>([]);
  const [isModalOpen, toggleModalOpen] = useToggle();
  const channels = props.channels ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channels</CardTitle>
        <CardDescription>
          Alert Channels are a way to configure <strong>how</strong> you want to receive alerts and
          notifications from Hive.
          <br />
          <DocsLink
            className="text-muted-foreground text-sm"
            href="/management/projects#alert-channels"
          >
            Learn more
          </DocsLink>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChannelsTable
          channels={channels}
          isChecked={channelId => selected.includes(channelId)}
          onCheckedChange={(channelId, isChecked) => {
            setSelected(
              isChecked ? [...selected, channelId] : selected.filter(k => k !== channelId),
            );
          }}
        />
      </CardContent>
      <CardFooter>
        <div className="mt-4 flex gap-x-2">
          <Button variant="default" onClick={toggleModalOpen}>
            Add channel
          </Button>
          {channels.length > 0 && (
            <DeleteChannelsButton
              organizationId={router.organizationId}
              projectId={router.projectId}
              selected={selected}
              onSuccess={() => {
                setSelected([]);
              }}
            />
          )}
        </div>
      </CardFooter>
      {isModalOpen && <CreateChannelModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />}
    </Card>
  );
}

export function Alerts(props: {
  alerts: FragmentType<typeof AlertsTable_AlertFragment>[];
  channels: FragmentType<typeof CreateAlertModal_AlertChannelFragment>[];
  targets: FragmentType<typeof CreateAlertModal_TargetFragment>[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();
  const alerts = props.alerts ?? [];

  console.log('isModalOpen', isModalOpen);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Alerts and Notifications</CardTitle>
          <CardDescription>
            Alerts are a way to configure <strong>when</strong> you want to receive alerts and
            notifications from Hive.
            <br />
            <DocsLink
              className="text-muted-foreground text-sm"
              href="/management/projects#alerts-and-notifications-1"
            >
              Learn more
            </DocsLink>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertsTable
            alerts={alerts}
            isChecked={alertId => selected.includes(alertId)}
            onCheckedChange={(alertId, isChecked) => {
              setSelected(isChecked ? [...selected, alertId] : selected.filter(k => k !== alertId));
            }}
          />
        </CardContent>
        <CardFooter>
          <div className="flex gap-x-2">
            <Button variant="default" onClick={toggleModalOpen}>
              Create alert
            </Button>
            <DeleteAlertsButton
              organizationId={router.organizationId}
              projectId={router.projectId}
              selected={selected}
              onSuccess={() => {
                setSelected([]);
              }}
            />
          </div>
        </CardFooter>
      </Card>
      {isModalOpen && (
        <CreateAlertModal
          targets={props.targets}
          channels={props.channels}
          isOpen={isModalOpen}
          toggleModalOpen={toggleModalOpen}
        />
      )}
    </>
  );
}

const ProjectAlertsPage_OrganizationFragment = graphql(`
  fragment ProjectAlertsPage_OrganizationFragment on Organization {
    cleanId
    me {
      ...CanAccessProject_MemberFragment
    }
  }
`);

const ProjectAlertsPageQuery = graphql(`
  query ProjectAlertsPageQuery($organizationId: ID!, $projectId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...ProjectLayout_CurrentOrganizationFragment
        ...ProjectAlertsPage_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...ProjectLayout_CurrentProjectFragment
      targets {
        nodes {
          ...CreateAlertModal_TargetFragment
        }
      }
      alerts {
        ...AlertsTable_AlertFragment
      }
      alertChannels {
        ...ChannelsTable_AlertChannelFragment
        ...CreateAlertModal_AlertChannelFragment
      }
    }
    organizations {
      ...ProjectLayout_OrganizationConnectionFragment
    }
    me {
      ...ProjectLayout_MeFragment
    }
  }
`);

function AlertsPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ProjectAlertsPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
    requestPolicy: 'cache-and-network',
  });

  useNotFoundRedirectOnError(!!query.error);

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const organizationConnection = query.data?.organizations;
  const organizationForAlerts = useFragment(
    ProjectAlertsPage_OrganizationFragment,
    currentOrganization,
  );

  useProjectAccess({
    scope: ProjectAccessScope.Alerts,
    member: organizationForAlerts?.me ?? null,
    redirect: true,
  });

  if (query.error) {
    return null;
  }

  const alerts = currentProject?.alerts || [];
  const channels = currentProject?.alertChannels || [];
  const targets = currentProject?.targets?.nodes || [];

  return (
    <ProjectLayout
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
      value="alerts"
      className="flex flex-col gap-y-10"
    >
      <div>
        <div className="py-6">
          <h3 className="text-lg font-semibold tracking-tight">Alerts and Notifications</h3>
          <p className="text-sm text-gray-400">
            Configure alerts and notifications for your project.
          </p>
        </div>
        {currentProject && currentOrganization ? (
          <div className="flex flex-col gap-y-4">
            <Channels channels={channels} />
            <Alerts alerts={alerts} channels={channels} targets={targets} />
          </div>
        ) : null}
      </div>
    </ProjectLayout>
  );
}

function AlertsPage(): ReactElement {
  return (
    <>
      <Title title="Alerts" />
      <AlertsPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(AlertsPage);
