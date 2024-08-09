import type { SchemaCheckErrorResolvers } from './../../../__generated__/types.next';

export const SchemaCheckError: SchemaCheckErrorResolvers = {
  __isTypeOf: obj => {
    return !obj.valid;
  },
};
