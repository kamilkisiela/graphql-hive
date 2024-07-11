import type { ActivityObject } from '../../../shared/entities';
import type { ProjectIdUpdatedActivityResolvers } from './../../../__generated__/types.next';

export const ProjectIdUpdatedActivity: ProjectIdUpdatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'PROJECT_ID_UPDATED';
  },
  value(activity: any) {
    return (activity as ActivityObject).meta.value;
  },
};
