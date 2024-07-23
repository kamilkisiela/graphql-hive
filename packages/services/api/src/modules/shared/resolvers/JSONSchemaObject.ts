import { JSONResolver } from 'graphql-scalars';

// `scalar JSON` in `module.graphql.ts` does not have a description
// and it messes up the static analysis
JSONResolver.description = undefined;

export const JSONSchemaObject = JSONResolver;
