import { Injectable, Scope } from 'graphql-modules';
import * as GraphQLSchema from '../../../__generated__/types';
import { Target } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { batch } from '../../../shared/helpers';
import { Session } from '../../auth/lib/authz';
import { GraphStore } from '../../graph/providers/graph-store';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import {
  registryOperationOutcomeCount,
  registryOperationUnexpectedErrorCount,
  unexpectedErrorMetricLabels,
} from '../../shared/providers/registry-operation-metrics';
import { TargetManager } from '../../target/providers/target-manager';
import { AppDeployments, type AppDeploymentRecord } from './app-deployments';
import type { PreprocessedDocument } from './persisted-document-ingester';

export type AppDeploymentStatus = 'pending' | 'active' | 'retired';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AppDeploymentsManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private session: Session,
    private targetManager: TargetManager,
    private appDeployments: AppDeployments,
    private idTranslator: IdTranslator,
    private graphs: GraphStore,
  ) {
    this.logger = logger.child({ source: 'AppDeploymentsManager' });
  }

  async getAppDeploymentForTarget(
    target: Target,
    appDeploymentInput: {
      name: string;
      version: string;
    },
  ): Promise<null | AppDeploymentRecord> {
    const appDeployment = await this.appDeployments.findAppDeployment({
      targetId: target.id,
      name: appDeploymentInput.name,
      version: appDeploymentInput.version,
    });

    return appDeployment;
  }

  async getAppDeploymentById(args: {
    appDeploymentId: string;
  }): Promise<AppDeploymentRecord | null> {
    return await this.appDeployments.getAppDeploymentById(args);
  }

  getStatusForAppDeployment(appDeployment: AppDeploymentRecord): AppDeploymentStatus {
    if (appDeployment.retiredAt) {
      return 'retired';
    }

    if (appDeployment.activatedAt) {
      return 'active';
    }

    return 'pending';
  }

  async createAppDeployment(args: {
    reference: GraphQLSchema.TargetReferenceInput | null;
    appDeployment: {
      name: string;
      version: string;
    };
  }) {
    return this.internalCreateAppDeployment(args).then(
      result => {
        registryOperationOutcomeCount.inc({
          operation: 'app_deployment_create',
          conclusion: 'success',
        });
        return result;
      },
      error => {
        if (error instanceof HiveError) {
          registryOperationOutcomeCount.inc({
            operation: 'app_deployment_create',
            conclusion: 'success',
          });
        } else {
          registryOperationOutcomeCount.inc({
            operation: 'app_deployment_create',
            conclusion: 'failure',
          });
          registryOperationUnexpectedErrorCount.inc(
            unexpectedErrorMetricLabels('app_deployment_create', error),
          );
        }
        throw error;
      },
    );
  }

  private async internalCreateAppDeployment(args: {
    reference: GraphQLSchema.TargetReferenceInput | null;
    appDeployment: {
      name: string;
      version: string;
    };
  }) {
    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.reference,
    });

    if (!selector) {
      this.session.raise('appDeployment:create');
    }

    await this.session.assertPerformAction({
      action: 'appDeployment:create',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
        appDeploymentName: args.appDeployment.name,
      },
    });

    return await this.appDeployments.createAppDeployment({
      organizationId: selector.organizationId,
      targetId: selector.targetId,
      appDeployment: args.appDeployment,
    });
  }

  async addDocumentsToAppDeployment(
    args: {
      reference: GraphQLSchema.TargetReferenceInput | null;
      appDeployment: {
        name: string;
        version: string;
      };
      documents: ReadonlyArray<{
        hash: string;
        body: string;
      }>;
    },
    signal: AbortSignal,
  ) {
    return this.trackDocumentUpload(
      () => this.internalAddDocumentsToAppDeployment(args, signal),
      signal,
    );
  }

  async addPreprocessedDocumentsToAppDeployment(
    args: {
      reference: GraphQLSchema.TargetReferenceInput | null;
      appDeployment: { name: string; version: string };
      documents: ReadonlyArray<PreprocessedDocument>;
    },
    signal: AbortSignal,
  ) {
    return this.trackDocumentUpload(
      () => this.internalAddPreprocessedDocumentsToAppDeployment(args, signal),
      signal,
    );
  }

  private async internalAddPreprocessedDocumentsToAppDeployment(
    args: {
      reference: GraphQLSchema.TargetReferenceInput | null;
      appDeployment: { name: string; version: string };
      documents: ReadonlyArray<PreprocessedDocument>;
    },
    signal: AbortSignal,
  ) {
    const selector = await this.idTranslator.resolveTargetReference({ reference: args.reference });
    if (!selector) {
      this.session.raise('appDeployment:create');
    }

    await this.session.assertPerformAction({
      action: 'appDeployment:create',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
        appDeploymentName: args.appDeployment.name,
      },
    });

    const target = await this.targetManager.getTargetById(selector);
    const graph = await this.graphs.getDefaultGraphForTargetId(target.id);
    return this.appDeployments.addPreprocessedDocumentsToAppDeployment(
      { graph, appDeployment: args.appDeployment, documents: args.documents },
      signal,
    );
  }

  private trackDocumentUpload<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return operation().then(
      result => {
        registryOperationOutcomeCount.inc({
          operation: 'persisted_document_upload',
          conclusion: 'success',
        });
        return result;
      },
      error => {
        if (signal.aborted) {
          registryOperationOutcomeCount.inc({
            operation: 'persisted_document_upload',
            conclusion: 'aborted',
          });
        } else if (error instanceof HiveError) {
          registryOperationOutcomeCount.inc({
            operation: 'persisted_document_upload',
            conclusion: 'success',
          });
        } else {
          registryOperationOutcomeCount.inc({
            operation: 'persisted_document_upload',
            conclusion: 'failure',
          });
          registryOperationUnexpectedErrorCount.inc(
            unexpectedErrorMetricLabels('persisted_document_upload', error),
          );
        }
        throw error;
      },
    );
  }

  private async internalAddDocumentsToAppDeployment(
    args: {
      reference: GraphQLSchema.TargetReferenceInput | null;
      appDeployment: {
        name: string;
        version: string;
      };
      documents: ReadonlyArray<{
        hash: string;
        body: string;
      }>;
    },
    signal: AbortSignal,
  ) {
    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.reference,
    });

    if (!selector) {
      this.session.raise('appDeployment:create');
    }

    await this.session.assertPerformAction({
      action: 'appDeployment:create',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
        appDeploymentName: args.appDeployment.name,
      },
    });

    const target = await this.targetManager.getTargetById(selector);
    const graph = await this.graphs.getDefaultGraphForTargetId(target.id);

    return await this.appDeployments.addDocumentsToAppDeployment(
      {
        graph,
        appDeployment: args.appDeployment,
        operations: args.documents,
      },
      signal,
    );
  }

  async activateAppDeployment(args: {
    reference: GraphQLSchema.TargetReferenceInput | null;
    appDeployment: {
      name: string;
      version: string;
    };
  }) {
    return this.internalActivateAppDeployment(args).then(
      result => {
        registryOperationOutcomeCount.inc({
          operation: 'app_deployment_publish',
          conclusion: 'success',
        });
        return result;
      },
      error => {
        if (error instanceof HiveError) {
          registryOperationOutcomeCount.inc({
            operation: 'app_deployment_publish',
            conclusion: 'success',
          });
        } else {
          registryOperationOutcomeCount.inc({
            operation: 'app_deployment_publish',
            conclusion: 'failure',
          });
          registryOperationUnexpectedErrorCount.inc(
            unexpectedErrorMetricLabels('app_deployment_publish', error),
          );
        }
        throw error;
      },
    );
  }

  private async internalActivateAppDeployment(args: {
    reference: GraphQLSchema.TargetReferenceInput | null;
    appDeployment: {
      name: string;
      version: string;
    };
  }) {
    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.reference,
    });

    if (!selector) {
      this.session.raise('appDeployment:publish');
    }

    await this.session.assertPerformAction({
      action: 'appDeployment:publish',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
        appDeploymentName: args.appDeployment.name,
      },
    });

    return await this.appDeployments.activateAppDeployment({
      organizationId: selector.organizationId,
      targetId: selector.targetId,
      appDeployment: args.appDeployment,
    });
  }

  async retireAppDeployment(args: {
    reference: GraphQLSchema.TargetReferenceInput | null;
    appDeployment: {
      name: string;
      version: string;
    };
    force?: boolean;
  }) {
    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.reference,
    });

    if (!selector) {
      this.session.raise('appDeployment:retire');
    }

    await this.session.assertPerformAction({
      action: 'appDeployment:retire',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
        appDeploymentName: args.appDeployment.name,
      },
    });

    return await this.appDeployments.retireAppDeployment({
      organizationId: selector.organizationId,
      projectId: selector.projectId,
      targetId: selector.targetId,
      appDeployment: args.appDeployment,
      force: args.force,
    });
  }

  async getPaginatedDocumentsForAppDeployment(
    appDeployment: AppDeploymentRecord,
    args: {
      cursor: string | null;
      first: number | null;
      operationName: string;
      schemaCoordinates: string[] | null;
    },
  ) {
    return await this.appDeployments.getPaginatedGraphQLDocuments({
      appDeploymentId: appDeployment.id,
      cursor: args.cursor,
      first: args.first,
      operationName: args.operationName,
      schemaCoordinates: args.schemaCoordinates,
    });
  }

  async getPaginatedAppDeploymentsForTarget(
    target: Target,
    args: {
      cursor: string | null;
      first: number | null;
      sort: {
        field: GraphQLSchema.AppDeploymentsSortField;
        direction: GraphQLSchema.SortDirectionType;
      } | null;
    },
  ) {
    const { sort, cursor, first } = args;

    const pagePromise =
      sort?.field === 'LAST_USED'
        ? this.appDeployments.getPaginatedAppDeploymentsSortedByLastUsed({
            targetId: target.id,
            cursor,
            first,
            direction: sort.direction,
          })
        : this.appDeployments.getPaginatedAppDeployments({
            targetId: target.id,
            cursor,
            first,
            sort: sort ? { field: sort.field, direction: sort.direction } : null,
          });

    const [page, total] = await Promise.all([
      pagePromise,
      this.appDeployments.countAppDeployments(target.id),
    ]);

    return { ...page, total };
  }

  async getActiveAppDeploymentsForTarget(
    target: Target,
    args: {
      cursor: string | null;
      first: number | null;
      filter: {
        name?: string | null;
        lastUsedBefore?: string | null;
        neverUsedAndCreatedBefore?: string | null;
      };
    },
  ) {
    const [page, total] = await Promise.all([
      this.appDeployments.getActiveAppDeployments({
        targetId: target.id,
        cursor: args.cursor,
        first: args.first,
        filter: args.filter,
      }),
      this.appDeployments.countAppDeployments(target.id),
    ]);

    return { ...page, total };
  }

  getDocumentCountForAppDeployment = batch<AppDeploymentRecord, number>(async args => {
    const appDeploymentIds = args.map(appDeployment => appDeployment.id);
    const counts = await this.appDeployments.getDocumentCountForAppDeployments({
      appDeploymentIds,
    });
    const countMap = new Map<string, number>();
    for (const count of counts) {
      countMap.set(count.appDeploymentId, count.count);
    }

    return appDeploymentIds.map(id => Promise.resolve(countMap.get(id) ?? 0));
  });

  getLastUsedForAppDeployment = batch<AppDeploymentRecord, string | null>(async args => {
    const appDeploymentIds = args.map(appDeployment => appDeployment.id);
    const dates = await this.appDeployments.getLastUsedForAppDeployments({
      appDeploymentIds,
    });
    const dateMap = new Map<string, string | null>();
    for (const count of dates) {
      dateMap.set(count.appDeploymentId, count.lastUsed);
    }

    return appDeploymentIds.map(id => Promise.resolve(dateMap.get(id) ?? null));
  });
}
