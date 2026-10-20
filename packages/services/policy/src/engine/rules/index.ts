import { rule as alphabetize } from './alphabetize.js';
import { rule as descriptionStyle } from './description-style.js';
import { rule as inputName } from './input-name.js';
import { rule as namingConvention } from './naming-convention.js';
import { rule as noCaseInsensitiveEnumValuesDuplicates } from './no-case-insensitive-enum-values-duplicates.js';
import { rule as noHashtagDescription } from './no-hashtag-description.js';
import { rule as noRootType } from './no-root-type.js';
import { rule as noScalarResultTypeOnMutation } from './no-scalar-result-type-on-mutation.js';
import { rule as noTypenamePrefix } from './no-typename-prefix.js';
import { rule as noUnreachableTypes } from './no-unreachable-types.js';
import { rule as relayArguments } from './relay-arguments.js';
import { rule as relayConnectionTypes } from './relay-connection-types.js';
import { rule as relayEdgeTypes } from './relay-edge-types.js';
import { rule as relayPageInfo } from './relay-page-info.js';
import { rule as requireDeprecationDate } from './require-deprecation-date.js';
import { rule as requireDeprecationReason } from './require-deprecation-reason.js';
import { rule as requireDescription } from './require-description.js';
import { rule as requireFieldOfTypeQueryInMutationResult } from './require-field-of-type-query-in-mutation-result.js';
import { rule as requireNullableFieldsWithOneof } from './require-nullable-fields-with-oneof.js';
import { rule as requireNullableResultInRoot } from './require-nullable-result-in-root.js';
import { rule as requireTypePatternWithOneof } from './require-type-pattern-with-oneof.js';
import { rule as strictIdInTypes } from './strict-id-in-types.js';

// The schema rules the policy service exposes, in graphql-eslint 3.20.1's key order.
export const rules = {
  alphabetize,
  'description-style': descriptionStyle,
  'input-name': inputName,
  'naming-convention': namingConvention,
  'no-case-insensitive-enum-values-duplicates': noCaseInsensitiveEnumValuesDuplicates,
  'no-hashtag-description': noHashtagDescription,
  'no-root-type': noRootType,
  'no-scalar-result-type-on-mutation': noScalarResultTypeOnMutation,
  'no-typename-prefix': noTypenamePrefix,
  'no-unreachable-types': noUnreachableTypes,
  'relay-arguments': relayArguments,
  'relay-connection-types': relayConnectionTypes,
  'relay-edge-types': relayEdgeTypes,
  'relay-page-info': relayPageInfo,
  'require-deprecation-date': requireDeprecationDate,
  'require-deprecation-reason': requireDeprecationReason,
  'require-description': requireDescription,
  'require-field-of-type-query-in-mutation-result': requireFieldOfTypeQueryInMutationResult,
  'require-nullable-fields-with-oneof': requireNullableFieldsWithOneof,
  'require-nullable-result-in-root': requireNullableResultInRoot,
  'require-type-pattern-with-oneof': requireTypePatternWithOneof,
  'strict-id-in-types': strictIdInTypes,
};
