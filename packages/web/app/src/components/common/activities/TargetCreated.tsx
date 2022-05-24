import React from 'react';
import { VscAdd } from 'react-icons/vsc';
import { TargetCreatedActivity } from '../../../graphql';
import { TimeAgo } from '../index';
import { Activity, Project, Target, User, useAddIconColor } from './common';

export const TargetCreated: React.FC<{
  activity: TargetCreatedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscAdd color={useAddIconColor()} />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> created{' '}
          <Target target={activity.target} project={activity.project} organization={activity.organization} /> target in{' '}
          <Project project={activity.project} organization={activity.organization} /> project
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
