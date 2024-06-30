import { AppDeploymentsManager } from '../../providers/app-deployments-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const addDocumentsToAppDeployment: NonNullable<
  MutationResolvers['addDocumentsToAppDeployment']
> = async (_parent, { input }, { injector }) => {
  const result = await injector.get(AppDeploymentsManager).addDocumentsToAppDeployment({
    appDeployment: {
      name: input.appName,
      version: input.appVersion,
    },
    documents: input.documents,
  });

  if (result.type === 'error') {
    return {
      error: {
        message: result.error.message,
        details: result.error.details,
      },
      ok: null,
    };
  }

  return {
    error: null,
    ok: {
      appDeployment: result.appDeployment,
    },
  };
};
