import { ActivityObject } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { ActivityModule } from './__generated__/types';

export const resolvers: ActivityModule.Resolvers = {
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
