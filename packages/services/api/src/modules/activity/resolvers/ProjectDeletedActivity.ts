import type { ActivityObject } from '../../../shared/entities';
import type { ProjectDeletedActivityResolvers } from './../../../__generated__/types.next';

export const ProjectDeletedActivity: ProjectDeletedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'PROJECT_DELETED';
  },
  name(activity: any) {
    return (activity as ActivityObject).meta.name;
  },
  cleanId(activity: any) {
    return (activity as ActivityObject).meta.cleanId;
  },
};
