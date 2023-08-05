import { OrganizationActivitiesQuery } from '@/graphql';

export type ActivityNode = OrganizationActivitiesQuery['organizationActivities']['nodes'][0];
