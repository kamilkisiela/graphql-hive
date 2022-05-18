import React from 'react';
import { VscAdd } from 'react-icons/vsc';
import { OrganizationCreatedActivity } from '../../../graphql';
import { TimeAgo } from '../index';
import { Activity, User, useAddIconColor } from './common';

export const OrganizationCreated: React.FC<{
  activity: OrganizationCreatedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscAdd color={useAddIconColor()} />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> created the organization
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
