import { ActivityObject } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { IdTranslator } from '../shared/providers/id-translator';
import { ActivityModule } from './__generated__/types';
import { ActivityManager } from './providers/activity-manager';

export const resolvers: ActivityModule.Resolvers = {
  Query: {
    async organizationActivities(_, { selector }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(selector);

      return injector.get(ActivityManager).getByOrganization({
        organization,
        limit: selector.limit,
      });
    },
    async projectActivities(_, { selector }, { injector }) {
      const [organization, project] = await Promise.all([
        injector.get(IdTranslator).translateOrganizationId(selector),
        injector.get(IdTranslator).translateProjectId(selector),
      ]);

      return injector.get(ActivityManager).getByProject({
        organization,
        project,
        limit: selector.limit,
      });
    },
    async targetActivities(_, { selector }, { injector }) {
      const [organization, project, target] = await Promise.all([
        injector.get(IdTranslator).translateOrganizationId(selector),
        injector.get(IdTranslator).translateProjectId(selector),
        injector.get(IdTranslator).translateTargetId(selector),
      ]);

      return injector.get(ActivityManager).getByTarget({
        organization,
        project,
        target,
        limit: selector.limit,
      });
    },
  },
  OrganizationCreatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'ORGANIZATION_CREATED';
    },
  },
  OrganizationPlanChangeActivity: {
    __isTypeOf(activity) {
      return activity.type === 'ORGANIZATION_PLAN_UPDATED';
    },
    newPlan(activity: any) {
      return (activity as ActivityObject).meta.newPlan;
    },
    previousPlan(activity: any) {
      return (activity as ActivityObject).meta.previousPlan;
    },
  },
  OrganizationNameUpdatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'ORGANIZATION_NAME_UPDATED';
    },
    value(activity: any) {
      return (activity as ActivityObject).meta.value;
    },
  },
  OrganizationIdUpdatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'ORGANIZATION_ID_UPDATED';
    },
    value(activity: any) {
      return (activity as ActivityObject).meta.value;
    },
  },
  MemberAddedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'MEMBER_ADDED';
    },
  },
  MemberDeletedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'MEMBER_DELETED';
    },
    email(activity: any) {
      return (activity as ActivityObject).meta.email;
    },
  },
  MemberLeftActivity: {
    __isTypeOf(activity) {
      return activity.type === 'MEMBER_LEFT';
    },
    email(activity: any) {
      return (activity as ActivityObject).meta.email;
    },
  },
  ProjectCreatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'PROJECT_CREATED';
    },
  },
  ProjectDeletedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'PROJECT_DELETED';
    },
    name(activity: any) {
      return (activity as ActivityObject).meta.name;
    },
    cleanId(activity: any) {
      return (activity as ActivityObject).meta.cleanId;
    },
  },
  ProjectNameUpdatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'PROJECT_NAME_UPDATED';
    },
    value(activity: any) {
      return (activity as ActivityObject).meta.value;
    },
  },
  ProjectIdUpdatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'PROJECT_ID_UPDATED';
    },
    value(activity: any) {
      return (activity as ActivityObject).meta.value;
    },
  },
  TargetCreatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'TARGET_CREATED';
    },
  },
  TargetDeletedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'TARGET_DELETED';
    },
    name(activity: any) {
      return (activity as ActivityObject).meta.name;
    },
    cleanId(activity: any) {
      return (activity as ActivityObject).meta.cleanId;
    },
  },
  TargetNameUpdatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'TARGET_NAME_UPDATED';
    },
    value(activity: any) {
      return (activity as ActivityObject).meta.value;
    },
  },
  TargetIdUpdatedActivity: {
    __isTypeOf(activity) {
      return activity.type === 'TARGET_ID_UPDATED';
    },
    value(activity: any) {
      return (activity as ActivityObject).meta.value;
    },
  },
  ActivityConnection: createConnection(),
};
