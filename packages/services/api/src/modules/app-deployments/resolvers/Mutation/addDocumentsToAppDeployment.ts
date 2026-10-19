import { AppDeploymentsManager } from '../../providers/app-deployments-manager';
import type { MutationResolvers } from './../../../../__generated__/types';

export const addDocumentsToAppDeployment: NonNullable<
  MutationResolvers['addDocumentsToAppDeployment']
> = async (_parent, { input }, { injector, request }) => {
  const result = await injector.get(AppDeploymentsManager).addDocumentsToAppDeployment(
    {
      reference: input.target ?? null,
      appDeployment: {
        name: input.appName,
        version: input.appVersion,
      },
      documents: input.documents,
    },
    request.signal,
  );

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
