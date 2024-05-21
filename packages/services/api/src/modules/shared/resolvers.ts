import {
  DateResolver,
  DateTimeResolver,
  JSONResolver,
  SafeIntResolver,
  UUIDResolver,
} from 'graphql-scalars';
import type { SharedModule } from './__generated__/types';

// Remove descriptions from resolvers
// `scalar JSON` in `module.graphql.ts` does not have a description
// and it messes up the static analysis
JSONResolver.description = undefined;
DateTimeResolver.description = undefined;
SafeIntResolver.description = undefined;
DateResolver.description = undefined;
UUIDResolver.description = undefined;

export const resolvers: SharedModule.Resolvers = {
  Date: DateResolver,
  DateTime: DateTimeResolver,
  JSON: JSONResolver,
  JSONSchemaObject: JSONResolver,
  SafeInt: SafeIntResolver,
  UUID: UUIDResolver,
  Query: {
    noop: () => true,
  },
  Mutation: {
    noop: () => true,
  },
};
