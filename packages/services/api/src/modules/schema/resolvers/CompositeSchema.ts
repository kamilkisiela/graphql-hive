import type { CompositeSchemaResolvers } from './../../../__generated__/types.next';

export const CompositeSchema: CompositeSchemaResolvers = {
  __isTypeOf: obj => {
    return obj.kind === 'composite' && obj.action === 'PUSH';
  },
  service: schema => {
    return schema.service_name;
  },
  source: schema => {
    return schema.sdl;
  },
  url: schema => {
    return schema.service_url;
  },
};
