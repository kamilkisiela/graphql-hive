import { Injectable, Scope } from 'graphql-modules';
import type { SchemaCheck, SchemaVersion } from '@hive/storage';
import type { Target } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import { AuthManager } from '../../auth/providers/auth-manager';
import { TargetAccessScope } from '../../auth/providers/scopes';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import {
  Contracts,
  type Contract,
  type ContractCheck,
  type ContractVersion,
  type CreateContractInput,
} from './contracts';

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

  public async disableContract(args: { contractId: string }) {
    const contract = await this.contracts.getContractById({ contractId: args.contractId });
    if (contract === null) {
      return {
        type: 'error' as const,
        message: 'Contract not found.',
      };
    }

    const breadcrumb = await this.storage.getTargetBreadcrumbForTargetId({
      targetId: contract.targetId,
    });
    if (!breadcrumb) {
      return {
        type: 'error' as const,
        message: 'Contract not found.',
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

    return await this.contracts.disableContract({
      contract,
    });
  }

  async getViewerCanDisableContractForContract(contract: Contract) {
    if (contract.isDisabled) {
      return false;
    }

    const breadcrumb = await this.storage.getTargetBreadcrumbForTargetId({
      targetId: contract.targetId,
    });
    if (!breadcrumb) {
      return false;
    }

    const [organizationId, projectId, targetId] = await Promise.all([
      this.idTranslator.translateOrganizationId(breadcrumb),
      this.idTranslator.translateProjectId(breadcrumb),
      this.idTranslator.translateTargetId(breadcrumb),
    ]);

    return await this.authManager
      .ensureTargetAccess({
        organization: organizationId,
        project: projectId,
        target: targetId,
        scope: TargetAccessScope.SETTINGS,
      })
      .then(() => true)
      .catch(() => false);
  }

  public async getPaginatedContractsForTarget(args: {
    target: Target;
    cursor: string | null;
    first: number | null;
  }) {
    await this.authManager.ensureTargetAccess({
      organization: args.target.orgId,
      project: args.target.projectId,
      target: args.target.id,
      scope: TargetAccessScope.SETTINGS,
    });

    return this.contracts.getPaginatedContractsByTargetId({
      targetId: args.target.id,
      cursor: args.cursor,
      first: args.first,
    });
  }

  @cache<string>(contractVersionId => contractVersionId)
  private async getContractVersionById(contractVersionId: string) {
    if (contractVersionId === null) {
      return null;
    }

    return await this.contracts.getContractVersionById({ contractVersionId });
  }

  public async getContractVersionForContractCheck(contractCheck: ContractCheck) {
    if (contractCheck.comparedContractVersionId === null) {
      return null;
    }
    return await this.getContractVersionById(contractCheck.comparedContractVersionId);
  }

  @cache<ContractVersion>(contractVersion => contractVersion.id)
  public async getPreviousContractVersionForContractVersion(contractVersion: ContractVersion) {
    return await this.contracts.getPreviousContractVersionForContractVersion({
      contractVersion,
    });
  }

  @cache<ContractVersion>(contractVersion => contractVersion.id)
  public async getDiffableContractVersionForContractVersion(contractVersion: ContractVersion) {
    return await this.contracts.getDiffableContractVersionForContractVersion({
      contractVersion,
    });
  }

  public async getBreakingChangesForContractVersion(contractVersion: ContractVersion) {
    return await this.contracts.getBreakingChangesForContractVersion({
      contractVersionId: contractVersion.id,
    });
  }

  public async getSafeChangesForContractVersion(contractVersion: ContractVersion) {
    return await this.contracts.getSafeChangesForContractVersion({
      contractVersionId: contractVersion.id,
    });
  }

  public async getContractVersionsForSchemaVersion(schemaVersion: SchemaVersion) {
    return await this.contracts.getContractVersionsForSchemaVersion({
      schemaVersionId: schemaVersion.id,
    });
  }

  public async getContractsChecksForSchemaCheck(schemaCheck: SchemaCheck) {
    return this.contracts.getPaginatedContractChecksBySchemaCheckId({
      schemaCheckId: schemaCheck.id,
    });
  }

  public async getIsFirstComposableContractVersionForContractVersion(
    contractVersion: ContractVersion,
  ) {
    const previousContractVersion =
      await this.getDiffableContractVersionForContractVersion(contractVersion);

    return !!previousContractVersion;
  }
}
