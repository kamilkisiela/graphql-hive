import { ActivityObject } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { ActivityModule } from './__generated__/types';

export const resolvers: ActivityModule.Resolvers = {
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
