import { Injectable, Scope } from 'graphql-modules';
import { AuthManager } from '../../auth/providers/auth-manager';
import { TargetAccessScope } from '../../auth/providers/scopes';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { Contracts, type CreateContractInput } from './contracts';

@Injectable({
  scope: Scope.Operation,
})
export class ContractsManager {
  private logger: Logger;
  constructor(
    logger: Logger,
    private contracts: Contracts,
    private storage: Storage,
    private authManager: AuthManager,
    private idTranslator: IdTranslator,
  ) {
    this.logger = logger.child({ service: 'ContractsManager' });
  }

  public async createContract(args: { contract: CreateContractInput }) {
    const breadcrumb = await this.storage.getTargetBreadcrumbForTargetId({
      targetId: args.contract.targetId,
    });
    if (!breadcrumb) {
      return {
        type: 'error' as const,
        errors: {
          targetId: 'Target not found.',
        },
      };
    }

    const [organizationId, projectId, targetId] = await Promise.all([
      this.idTranslator.translateOrganizationId(breadcrumb),
      this.idTranslator.translateProjectId(breadcrumb),
      this.idTranslator.translateTargetId(breadcrumb),
    ]);

    await this.authManager.ensureTargetAccess({
      organization: organizationId,
      project: projectId,
      target: targetId,
      scope: TargetAccessScope.SETTINGS,
    });

    return await this.contracts.createContract(args);
  }
}
