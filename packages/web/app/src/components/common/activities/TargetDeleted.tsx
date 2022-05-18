import React from 'react';
import { VscTrash } from 'react-icons/vsc';
import { TargetDeletedActivity } from '../../../graphql';
import { TimeAgo } from '../index';
import {
  Activity,
  Highlight,
  Project,
  User,
  useRemoveIconColor,
} from './common';

export const TargetDeleted: React.FC<{
  activity: TargetDeletedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscTrash color={useRemoveIconColor()} />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> removed target{' '}
          <Highlight>{activity.name}</Highlight> from{' '}
          <Project
            project={activity.project}
            organization={activity.organization}
          />{' '}
          project
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
