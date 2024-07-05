import { ActivityObject } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { ActivityModule } from './__generated__/types';

export const resolvers: ActivityModule.Resolvers = {
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
