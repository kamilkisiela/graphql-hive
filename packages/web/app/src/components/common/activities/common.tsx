import type {
  OrganizationActivitiesQuery,
  ProjectActivitiesQuery,
  TargetActivitiesQuery,
} from '@/graphql';

export type ActivityNode =
  | OrganizationActivitiesQuery['organizationActivities']['nodes'][0]
  | ProjectActivitiesQuery['projectActivities']['nodes'][0]
  | TargetActivitiesQuery['targetActivities']['nodes'][0];
