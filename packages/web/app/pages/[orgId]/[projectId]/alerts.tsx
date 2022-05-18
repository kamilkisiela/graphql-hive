import { FC, useCallback, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { Button, Checkbox, Heading, Table, Tag, Title } from '@/components/v2';
import { CreateAlertModal, CreateChannelModal } from '@/components/v2/modals';
import {
  AlertChannelsDocument,
  AlertChannelType,
  AlertsDocument,
  DeleteAlertChannelsDocument,
  DeleteAlertsDocument,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const channelAlertsColumns = [
  { key: 'checkbox', width: 'auto' },
  { key: 'name' },
  { key: 'type' },
] as const;

const alertsColumns = [
  { key: 'checkbox', width: 'auto' },
  { key: 'type' },
  { key: 'channelName' },
  { key: 'targetName' },
] as const;

const Channels: FC = () => {
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
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);
  const [mutation, mutate] = useMutation(DeleteAlertChannelsDocument);

  const channelAlerts = channelAlertsQuery.data?.alertChannels || [];

  return (
    <div>
      <Heading className="mb-2">Available Channels</Heading>
      <p className="mb-3 font-light text-gray-500">
        Channel represents a form of communication
      </p>
      <Table
        dataSource={channelAlerts.map((channelAlert) => ({
          id: channelAlert.id,
          name: channelAlert.name,
          checkbox: (
            <Checkbox
              onCheckedChange={(isChecked) =>
                setChecked(
                  isChecked
                    ? [...checked, channelAlert.id]
                    : checked.filter((k) => k !== channelAlert.id)
                )
              }
              checked={checked.includes(channelAlert.id)}
            />
          ),
          type: (
            <Tag
              color={
                channelAlert.type === AlertChannelType.Webhook
                  ? 'green'
                  : 'yellow'
              }
            >
              {channelAlert.type}
            </Tag>
          ),
        }))}
        columns={channelAlertsColumns}
      />
      <div className="mt-4 flex gap-x-2">
        <Button size="large" variant="primary" onClick={toggleModalOpen}>
          Add channel
        </Button>
        {channelAlerts.length > 0 && (
          <Button
            size="large"
            danger
            disabled={checked.length === 0 || mutation.fetching}
            onClick={() => {
              mutate({
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
      {isModalOpen && (
        <CreateChannelModal
          isOpen={isModalOpen}
          toggleModalOpen={toggleModalOpen}
        />
      )}
    </div>
  );
};

const AlertsPage: FC = () => {
  const [checked, setChecked] = useState<string[]>([]);
  const router = useRouteSelector();
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);
  const [mutation, mutate] = useMutation(DeleteAlertsDocument);
  const [alertsQuery] = useQuery({
    query: AlertsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const alerts = alertsQuery.data?.alerts || [];

  return (
    <div className="flex flex-col gap-y-10">
      <Title title="Alerts" />
      <Channels />
      <div>
        <Heading className="mb-2">Active Alerts</Heading>
        <p className="mb-3 font-light text-gray-500">
          Alerts are sent over the Channels
        </p>
        <Table
          dataSource={alerts.map((alert) => ({
            id: alert.id,
            type: (
              <span className="capitalize">
                {alert.type.replaceAll('_', ' ').toLowerCase()}
              </span>
            ),
            checkbox: (
              <Checkbox
                onCheckedChange={(isChecked) =>
                  setChecked(
                    isChecked
                      ? [...checked, alert.id]
                      : checked.filter((k) => k !== alert.id)
                  )
                }
                checked={checked.includes(alert.id)}
              />
            ),
            channelName: `Channel: ${alert.channel.name}`,
            targetName: `Target: ${alert.target.name}`,
          }))}
          columns={alertsColumns}
        />
        <div className="mt-4 flex gap-x-2">
          <Button size="large" variant="primary" onClick={toggleModalOpen}>
            Create alert
          </Button>
          {alerts.length > 0 && (
            <Button
              size="large"
              danger
              disabled={checked.length === 0 || mutation.fetching}
              onClick={() => {
                mutate({
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
      </div>
      {isModalOpen && (
        <CreateAlertModal
          isOpen={isModalOpen}
          toggleModalOpen={toggleModalOpen}
        />
      )}
    </div>
  );
};

export default AlertsPage;
