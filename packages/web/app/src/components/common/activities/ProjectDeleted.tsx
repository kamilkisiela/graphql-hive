import React from 'react';
import { VscTrash } from 'react-icons/vsc';
import { ProjectDeletedActivity } from '../../../graphql';
import { TimeAgo } from '../index';
import { Activity, Highlight, User, useRemoveIconColor } from './common';

export const ProjectDeleted: React.FC<{
  activity: ProjectDeletedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscTrash color={useRemoveIconColor()} />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> removed project{' '}
          <Highlight>{activity.name}</Highlight>
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
