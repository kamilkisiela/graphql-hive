import React from 'react';
import { VscPerson } from 'react-icons/vsc';
import { MemberDeletedActivity } from '../../../graphql';
import { TimeAgo } from '../index';
import { Activity, User, useRemoveIconColor } from './common';

export const MemberDeleted: React.FC<{
  activity: MemberDeletedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscPerson color={useRemoveIconColor()} />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.email} /> from the organization by <User user={activity.user} />
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
