import React from 'react';
import { VscEdit } from 'react-icons/vsc';
import { OrganizationPlanChangeActivity } from '../../../graphql';
import { Activity, User, Highlight } from './common';
import { TimeAgo } from '../index';

export const OrganizationPlanChange: React.FC<{
  activity: OrganizationPlanChangeActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscEdit />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> changed organization plan to <Highlight>{activity.newPlan}</Highlight>
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
