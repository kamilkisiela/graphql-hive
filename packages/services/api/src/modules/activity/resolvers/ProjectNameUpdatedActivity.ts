import type { ActivityObject } from '../../../shared/entities';
import type { ProjectNameUpdatedActivityResolvers } from './../../../__generated__/types.next';

export const ProjectNameUpdatedActivity: ProjectNameUpdatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'PROJECT_NAME_UPDATED';
  },
  value(activity: any) {
    return (activity as ActivityObject).meta.value;
  },
};
