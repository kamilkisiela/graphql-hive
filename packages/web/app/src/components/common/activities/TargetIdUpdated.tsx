import React from 'react';
import { VscEdit } from 'react-icons/vsc';
import { TargetIdUpdatedActivity } from '../../../graphql';
import { Activity, User, Target, Project, Highlight } from './common';
import { TimeAgo } from '../index';

export const TargetIdUpdated: React.FC<{
  activity: TargetIdUpdatedActivity;
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
            target={activity.target}
            project={activity.project}
            organization={activity.organization}
          />{' '}
          target id to <Highlight>{activity.value}</Highlight> in{' '}
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
