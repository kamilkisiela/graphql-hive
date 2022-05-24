import React from 'react';
import { VscEdit } from 'react-icons/vsc';
import { ProjectNameUpdatedActivity } from '../../../graphql';
import { Activity, User, Project } from './common';
import { TimeAgo } from '../index';

export const ProjectNameUpdated: React.FC<{
  activity: ProjectNameUpdatedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscEdit />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> changed{' '}
          <Project project={activity.project} organization={activity.organization} /> name
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
