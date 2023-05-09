import { DefinitionNode, Kind, OperationDefinitionNode, parse } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { hashOperation, normalizeOperation } from '@graphql-hive/core';
import { PersistedOperationsModule } from '../__generated__/types';
import type { PersistedOperation } from '../../../shared/entities';
import { AuthManager } from '../../auth/providers/auth-manager';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { Logger } from '../../shared/providers/logger';
import {
  PersistedOperationSelector,
  ProjectSelector,
  Storage,
} from '../../shared/providers/storage';

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
})
export class PersistedOperationManager {
  private logger: Logger;

  constructor(logger: Logger, private storage: Storage, private authManager: AuthManager) {
    this.logger = logger.child({ source: 'PersistedOperationManager' });
  }

  async createPersistedOperations(
    operationList: readonly PersistedOperationsModule.PublishPersistedOperationInput[],
    project: string,
    organization: string,
  ): Promise<PersistedOperationsModule.PublishPersistedOperationPayload> {
    this.logger.info(
      'Creating persisted operations (project=%s, organization=%s, size=%s)',
      project,
      organization,
      operationList.length,
    );
    await this.authManager.ensureProjectAccess({
      project,
      organization,
      scope: ProjectAccessScope.OPERATIONS_STORE_WRITE,
    });

    const operations = operationList.map(operation => {
      const document = parse(operation.content);
      const normalizedDocument = normalizeOperation({
        document,
        hideLiterals: true,
        removeAliases: true,
      });
      const operationHash = operation.operationHash || hashOperation(normalizedDocument);
      const op = document.definitions.find(isOperation)!;

      return {
        operationHash,
        project,
        organization,
        name: op.name?.value ?? 'anonymous',
        kind: op.operation,
        content: normalizedDocument,
      };
    });

    const hashesToPublish = await this.comparePersistedOperations({
      organization,
      project,
      hashes: operations.map(op => op.operationHash),
    });

    const publishedOperations = await Promise.all(
      operations
        .filter(op => hashesToPublish.includes(op.operationHash))
        .map(operation => this.storage.insertPersistedOperation(operation)),
    );

    const unchangedOperations = await this.getSelectedPersistedOperations(
      { organization, project },
      operations
        .filter(op => !hashesToPublish.includes(op.operationHash))
        .map(op => op.operationHash),
    );
    const total = operations.length;
    const unchanged = total - hashesToPublish.length;

    return {
      summary: {
        total,
        unchanged,
      },
      operations: [...publishedOperations, ...unchangedOperations],
    };
  }

  async deletePersistedOperation({
    organization,
    project,
    operation,
  }: PersistedOperationSelector): Promise<PersistedOperation> {
    this.logger.info(
      'Deleting an operation (operation=%s, project=%s, organization=%s)',
      operation,
      project,
      organization,
    );
    await this.authManager.ensureProjectAccess({
      project,
      organization,
      scope: ProjectAccessScope.OPERATIONS_STORE_WRITE,
    });

    const result = await this.storage.deletePersistedOperation({
      project,
      organization,
      operation,
    });

    return result;
  }

  async comparePersistedOperations(
    selector: ProjectSelector & {
      hashes: readonly string[];
    },
  ): Promise<readonly string[]> {
    this.logger.debug('Fetching persisted operations (selector=%o)', selector);
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.OPERATIONS_STORE_READ,
    });
    return this.storage.comparePersistedOperations(selector);
  }

  async getPersistedOperations(selector: ProjectSelector): Promise<readonly PersistedOperation[]> {
    this.logger.debug('Fetching persisted operations (selector=%o)', selector);
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.OPERATIONS_STORE_READ,
    });
    return this.storage.getPersistedOperations(selector);
  }

  async getPersistedOperation(selector: PersistedOperationSelector): Promise<PersistedOperation> {
    this.logger.debug('Fetching target (selector=%o)', selector);
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.OPERATIONS_STORE_READ,
    });
    return this.storage.getPersistedOperation(selector);
  }

  private async getSelectedPersistedOperations(
    selector: ProjectSelector,
    hashes: readonly string[],
  ): Promise<readonly PersistedOperation[]> {
    this.logger.debug(
      'Fetching selected persisted operations (selector=%o, size=%s)',
      selector,
      hashes.length,
    );
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.OPERATIONS_STORE_READ,
    });

    if (hashes.length === 0) {
      return [];
    }

    return this.storage.getSelectedPersistedOperations({
      ...selector,
      hashes,
    });
  }
}

function isOperation(def: DefinitionNode): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}
