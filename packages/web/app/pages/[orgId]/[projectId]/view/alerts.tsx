import { ReactElement, useState } from 'react';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { ProjectLayout } from '@/components/layouts';
import {
  Button,
  Card,
  Checkbox,
  DocsLink,
  DocsNote,
  Heading,
  Table,
  Tag,
  TBody,
  Td,
  Title,
  Tr,
} from '@/components/v2';
import { CreateAlertModal, CreateChannelModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  AlertChannelsDocument,
  AlertChannelType,
  AlertsDocument,
  DeleteAlertChannelsDocument,
  DeleteAlertsDocument,
} from '@/graphql';
import { ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';

function Channels(): ReactElement {
  const router = useRouteSelector();
  const [checked, setChecked] = useState<string[]>([]);
  const [channelAlertsQuery] = useQuery({
    query: AlertChannelsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [mutation, mutate] = useMutation(DeleteAlertChannelsDocument);

  const channelAlerts = channelAlertsQuery.data?.alertChannels || [];

  return (
    <Card>
      <Heading className="mb-2">Available Channels</Heading>
      <DocsNote>
        Alert Channels are a way to configure <strong>how</strong> you want to receive alerts and
        notifications from Hive.{' '}
        <DocsLink href="/management/projects#alert-channels">Learn more</DocsLink>
      </DocsNote>
      <Table>
        <TBody>
          {channelAlerts.map(channelAlert => (
            <Tr key={channelAlert.id}>
              <Td width="1">
                <Checkbox
                  onCheckedChange={isChecked =>
                    setChecked(
                      isChecked
                        ? [...checked, channelAlert.id]
                        : checked.filter(k => k !== channelAlert.id),
                    )
                  }
                  checked={checked.includes(channelAlert.id)}
                />
              </Td>
              <Td>{channelAlert.name}</Td>
              <Td className="text-xs truncate text-gray-400">
                {channelAlert.__typename === 'AlertSlackChannel'
                  ? channelAlert.channel
                  : channelAlert.__typename === 'AlertWebhookChannel'
                  ? channelAlert.endpoint
                  : ''}
              </Td>
              <Td>
                <Tag color={channelAlert.type === AlertChannelType.Webhook ? 'green' : 'yellow'}>
                  {channelAlert.type}
                </Tag>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <div className="mt-4 flex gap-x-2">
        <Button size="large" variant="primary" onClick={toggleModalOpen}>
          Add channel
        </Button>
        {channelAlerts.length > 0 && (
          <Button
            size="large"
            danger
            disabled={checked.length === 0 || mutation.fetching}
            onClick={async () => {
              await mutate({
                input: {
                  organization: router.organizationId,
                  project: router.projectId,
                  channels: checked,
                },
              });
              setChecked([]);
            }}
          >
            Delete {checked.length || null}
          </Button>
        )}
      </div>
      {isModalOpen && <CreateChannelModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />}
    </Card>
  );
}

const AlertsPage_OrganizationFragment = graphql(`
  fragment AlertsPage_OrganizationFragment on Organization {
    cleanId
    me {
      ...CanAccessProject_MemberFragment
    }
  }
`);

const AlertsPage_ProjectFragment = graphql(`
  fragment AlertsPage_ProjectFragment on Project {
    cleanId
  }
`);

const Page = (props: {
  organization: FragmentType<typeof AlertsPage_OrganizationFragment>;
  project: FragmentType<typeof AlertsPage_ProjectFragment>;
}) => {
  const organization = useFragment(AlertsPage_OrganizationFragment, props.organization);
  const project = useFragment(AlertsPage_ProjectFragment, props.project);
  useProjectAccess({
    scope: ProjectAccessScope.Alerts,
    member: organization.me,
    redirect: true,
  });
  const [checked, setChecked] = useState<string[]>([]);
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [mutation, mutate] = useMutation(DeleteAlertsDocument);
  const [alertsQuery] = useQuery({
    query: AlertsDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const alerts = alertsQuery.data?.alerts || [];
  return (
    <>
      <Channels />
      <Card>
        <Heading className="mb-2">Active Alerts and Notifications</Heading>
        <DocsNote>
          Alerts are a way to configure <strong>when</strong> you want to receive alerts and
          notifications from Hive.{' '}
          <DocsLink href="/management/projects#alerts-and-notifications-1">Learn more</DocsLink>
        </DocsNote>
        <Table>
          <TBody>
            {alerts.map(alert => (
              <Tr key={alert.id}>
                <Td width="1">
                  <Checkbox
                    onCheckedChange={isChecked =>
                      setChecked(
                        isChecked ? [...checked, alert.id] : checked.filter(k => k !== alert.id),
                      )
                    }
                    checked={checked.includes(alert.id)}
                  />
                </Td>
                <Td>
                  <span className="capitalize">
                    {alert.type.replaceAll('_', ' ').toLowerCase()}
                  </span>
                </Td>
                <Td>Channel: {alert.channel.name}</Td>
                <Td>Target: {alert.target.name}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        <div className="mt-4 flex gap-x-2">
          <Button size="large" variant="primary" onClick={toggleModalOpen}>
            Create alert
          </Button>
          {alerts.length > 0 && (
            <Button
              size="large"
              danger
              disabled={checked.length === 0 || mutation.fetching}
              onClick={async () => {
                await mutate({
                  input: {
                    organization: router.organizationId,
                    project: router.projectId,
                    alerts: checked,
                  },
                });
                setChecked([]);
              }}
            >
              Delete {checked.length || null}
            </Button>
          )}
        </div>
      </Card>
      {isModalOpen && <CreateAlertModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />}
    </>
  );
};

const ProjectAlertsPageQuery = graphql(`
  query ProjectAlertsPageQuery($organizationId: ID!, $projectId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...ProjectLayout_OrganizationFragment
        ...AlertsPage_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...ProjectLayout_ProjectFragment
      ...AlertsPage_ProjectFragment
    }
  }
`);

function AlertsPage(): ReactElement {
  return (
    <>
      <Title title="Alerts" />
      <ProjectLayout
        value="alerts"
        className="flex flex-col gap-y-10"
        query={ProjectAlertsPageQuery}
      >
        {props => <Page organization={props.organization.organization} project={props.project} />}
      </ProjectLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(AlertsPage);
