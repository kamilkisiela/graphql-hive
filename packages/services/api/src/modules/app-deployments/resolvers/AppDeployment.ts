import { AppDeploymentsManager } from '../providers/app-deployments-manager';
import type { AppDeploymentResolvers } from './../../../__generated__/types.next';

/*
 * Note: This object type is generated because "AppDeploymentMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some senarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const AppDeployment: AppDeploymentResolvers = {
  /* Implement AppDeployment resolver logic here */
  operations: async (_parent, _arg, _ctx) => {
    throw new Error('TO BE IMPLEMENTED');
  },
  status: async (appDeployment, _arg, { injector }) => {
    return injector.get(AppDeploymentsManager).getStatusForAppDeployment(appDeployment);
  },
};
