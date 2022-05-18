import React from 'react';
import { VscEdit } from 'react-icons/vsc';
import { ProjectIdUpdatedActivity } from '../../../graphql';
import { Activity, User, Project } from './common';
import { TimeAgo } from '../index';

export const ProjectIdUpdated: React.FC<{
  activity: ProjectIdUpdatedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscEdit />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> changed{' '}
          <Project
            project={activity.project}
            organization={activity.organization}
          />{' '}
          id
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
