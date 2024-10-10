import type { SchemaCheckSuccessResolvers } from './../../../__generated__/types.next';

export const SchemaCheckSuccess: SchemaCheckSuccessResolvers = {
  __isTypeOf: obj => {
    return obj.valid;
  },
};
