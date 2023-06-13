import type { Target } from '../../shared/entities';
import type { FailedSchemaCheckMapper, SuccessfulSchemaCheckMapper } from '../../shared/mappers';
import type { InflatedSchemaCheck } from './providers/schema-manager';

/**
 * Helper function for transforming a "raw" schema check from the database into a mapper object for the GraphQL resolver phase.
 */
export const toGraphQLSchemaCheck = (target: Target) => {
  const selector = {
    organizationId: target.orgId,
    projectId: target.projectId,
  };
  return function toGraphQLSchemaCheck(
    schemaCheck: InflatedSchemaCheck,
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
  };
};
