import type { TargetResolvers } from '../../../__generated__/types.next';
import { PreflightScriptProvider } from '../providers/preflight-script.provider';

/*
 * Note: This object type is generated because "TargetMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const Target: Pick<TargetResolvers, 'preflightScript' | '__isTypeOf'> = {
  preflightScript: (parent, _args, { injector }) =>
    injector.get(PreflightScriptProvider).getPreflightScript(parent.id),
};
