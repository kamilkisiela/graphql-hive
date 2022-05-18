import React from 'react';
import { VscAdd } from 'react-icons/vsc';
import { ProjectCreatedActivity } from '../../../graphql';
import { TimeAgo } from '../index';
import { Activity, Project, User, useAddIconColor } from './common';

export const ProjectCreated: React.FC<{
  activity: ProjectCreatedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscAdd color={useAddIconColor()} />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> created{' '}
          <Project
            project={activity.project}
            organization={activity.organization}
          />
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
