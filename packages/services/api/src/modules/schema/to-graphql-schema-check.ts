import type {
  FailedSchemaCheckMapper,
  SuccessfulSchemaCheckMapper,
} from './module.graphql.mappers';
import lodash from 'lodash';
import { SchemaCheck } from '@hive/storage';

const { curry } = lodash;
/**
 * Helper function for transforming a "raw" schema check from the database into a mapper object for the GraphQL resolver phase.
 */
export function toGraphQLSchemaCheck(
  selector: { organizationId: string; projectId: string },
  schemaCheck: SchemaCheck,
): SuccessfulSchemaCheckMapper | FailedSchemaCheckMapper {
  if (schemaCheck.isSuccess) {
    return {
      __typename: 'SuccessfulSchemaCheck' as const,
      selector,
      ...schemaCheck,
    };
  }

  return {
    __typename: 'FailedSchemaCheck' as const,
    selector,
    ...schemaCheck,
  };
}

export const toGraphQLSchemaCheckCurry = curry(toGraphQLSchemaCheck);
