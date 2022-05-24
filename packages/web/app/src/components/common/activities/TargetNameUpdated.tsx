import React from 'react';
import { VscEdit } from 'react-icons/vsc';
import { TargetNameUpdatedActivity } from '../../../graphql';
import { Activity, User, Target, Project } from './common';
import { TimeAgo } from '../index';

export const TargetNameUpdated: React.FC<{
  activity: TargetNameUpdatedActivity;
}> = ({ activity }) => {
  return (
    <Activity.Root>
      <Activity.Icon>
        <VscEdit />
      </Activity.Icon>
      <Activity.Content>
        <Activity.Text>
          <User user={activity.user} /> changed{' '}
          <Target
            name={activity.value}
            target={activity.target}
            project={activity.project}
            organization={activity.organization}
          />{' '}
          target name in <Project project={activity.project} organization={activity.organization} /> project
        </Activity.Text>
        <Activity.Time>
          <TimeAgo date={activity.createdAt} />
        </Activity.Time>
      </Activity.Content>
    </Activity.Root>
  );
};
