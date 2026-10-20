import { AppDeploymentsManager } from '../../providers/app-deployments-manager';
import type { MutationResolvers } from './../../../../__generated__/types';

export const addPreprocessedDocumentsToAppDeployment: NonNullable<
  MutationResolvers['addPreprocessedDocumentsToAppDeployment']
> = async (_parent, { input }, { injector, request }) => {
  const result = await injector.get(AppDeploymentsManager).addPreprocessedDocumentsToAppDeployment(
    {
      reference: input.target ?? null,
      appDeployment: { name: input.appName, version: input.appVersion },
      documents: input.documents.map(document => ({
        ...document,
        operationName: document.operationName ?? null,
      })),
    },
    request.signal,
  );

  if (result.type === 'error') {
    return {
      error: { message: result.error.message, details: result.error.details },
    };
  }

  return { ok: { appDeployment: result.appDeployment } };
};
