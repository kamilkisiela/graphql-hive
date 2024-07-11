import type { ActivityObject } from '../../../shared/entities';
import type { OrganizationPlanChangeActivityResolvers } from './../../../__generated__/types.next';

export const OrganizationPlanChangeActivity: OrganizationPlanChangeActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'ORGANIZATION_PLAN_UPDATED';
  },
  newPlan(activity: any) {
    return (activity as ActivityObject).meta.newPlan;
  },
  previousPlan(activity: any) {
    return (activity as ActivityObject).meta.previousPlan;
  },
};
