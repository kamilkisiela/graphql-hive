import type { ProjectCreatedActivityResolvers } from './../../../__generated__/types.next';

export const ProjectCreatedActivity: ProjectCreatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'PROJECT_CREATED';
  },
};
