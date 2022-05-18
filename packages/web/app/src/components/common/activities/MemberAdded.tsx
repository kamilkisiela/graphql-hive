import React from 'react';
import { VscPerson } from 'react-icons/vsc';
import { MemberAddedActivity } from '../../../graphql';
import { TimeAgo } from '../index';
import { Activity, User, useAddIconColor } from './common';

export const MemberAdded: React.FC<{
  activity: MemberAddedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscPerson color={useAddIconColor()} />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> joined the organization
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
