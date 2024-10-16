import type { SingleSchemaResolvers } from './../../../__generated__/types.next';

export const SingleSchema: SingleSchemaResolvers = {
  __isTypeOf: obj => {
    return obj.kind === 'single';
  },
  source: schema => {
    return schema.sdl;
  },
};
