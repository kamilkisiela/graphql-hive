import { Injectable, Scope } from 'graphql-modules';
import type { SchemaCheck } from '@hive/storage';
import * as GraphQLSchema from '../../../__generated__/types';
import { cache } from '../../../shared/helpers';
import { Session } from '../../auth/lib/authz';
import { ContractGraph, Graph, GraphStore } from '../../graph/providers/graph-store';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { BreakingSchemaChangeUsageHelper } from './breaking-schema-changes-helper';
import {
  Contracts,
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
    private graphStore: GraphStore,
    private session: Session,
    private idTranslator: IdTranslator,
    private breakingSchemaChangeUsageHelper: BreakingSchemaChangeUsageHelper,
  ) {
    this.logger = logger.child({ service: 'ContractsManager' });
  }

  public async createContract(args: {
    target: GraphQLSchema.TargetReferenceInput;
    contract: Omit<CreateContractInput, 'targetId'>;
  }) {
    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.target,
    });

    if (!selector) {
      return {
        type: 'error' as const,
        message: 'Something went wrong.',
        errors: {
          target: 'Target not found.',
        },
      };
    }

    const { organizationId, projectId, targetId } = selector;

    await this.session.assertPerformAction({
      action: 'target:modifySettings',
      organizationId,
      params: {
        organizationId,
        projectId,
        targetId,
      },
    });

    const sourceGraph = await this.graphStore.findGraphForTargetIdByName(targetId, 'default');

    if (!sourceGraph) {
      return {
        type: 'error' as const,
        message: "Graph 'default' not found.",
        errors: {},
      };
    }

    return await this.contracts.createContract({
      organizationId,
      projectId,
      sourceGraphId: sourceGraph.id,
      contract: {
        ...args.contract,
        targetId,
      },
    });
  }

  public async deleteContract(args: { contractId: string }) {
    const graph = await this.graphStore.findContractGraphById(args.contractId);
    if (graph === null) {
      return {
        type: 'error' as const,
        message: 'Contract not found.',
      };
    }

    await this.session.assertPerformAction({
      action: 'target:modifySettings',
      organizationId: graph.organizationId,
      params: {
        organizationId: graph.organizationId,
        projectId: graph.projectId,
        targetId: graph.targetId,
      },
    });

    return await this.contracts.deleteContractGraph(graph);
  }

  async getViewerCanDeleteContractForContractGraph(graph: ContractGraph): Promise<boolean> {
    return await this.session.canPerformAction({
      action: 'target:modifySettings',
      organizationId: graph.organizationId,
      params: {
        organizationId: graph.organizationId,
        projectId: graph.projectId,
        targetId: graph.targetId,
      },
    });
  }

  public async getPaginatedContractGraphsForGraph(
    graph: Graph,
    args: {
      cursor: string | null;
      first: number | null;
    },
  ) {
    await this.session.assertPerformAction({
      action: 'project:describe',
      organizationId: graph.organizationId,
      params: {
        organizationId: graph.organizationId,
        projectId: graph.projectId,
      },
    });

    return await this.graphStore.getPaginatedContractGraphsForGraph(graph, {
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

  public async getIsFirstComposableVersionForContractVersion(contractVersion: ContractVersion) {
    const diffableContractVersion =
      await this.getDiffableContractVersionForContractVersion(contractVersion);
    return !diffableContractVersion && contractVersion.schemaCompositionErrors === null;
  }

  public async getBreakingChangesForContractVersion(contractVersion: ContractVersion) {
    return (await this.getAllChangesForContractVersion(contractVersion))?.filter(
      change => change.criticality === 'BREAKING',
    );
  }

  public async getSafeChangesForContractVersion(contractVersion: ContractVersion) {
    return (await this.getAllChangesForContractVersion(contractVersion))?.filter(
      change => change.criticality !== 'BREAKING',
    );
  }

  @cache<ContractVersion>(contractVersion => `${contractVersion.source}:${contractVersion.id}`)
  public async getAllChangesForContractVersion(contractVersion: ContractVersion) {
    return await this.contracts.getAllChangesForContractVersion({
      contractVersion,
    });
  }

  public async getContractsChecksForSchemaCheck(schemaCheck: SchemaCheck) {
    const contractChecks = await this.contracts.getPaginatedContractChecksBySchemaCheckId({
      schemaCheckId: schemaCheck.id,
    });

    if (contractChecks?.edges && schemaCheck.conditionalBreakingChangeMetadata) {
      for (const edge of contractChecks.edges) {
        if (edge.node.breakingSchemaChanges) {
          for (const breakingSchemaChange of edge.node.breakingSchemaChanges) {
            this.breakingSchemaChangeUsageHelper.registerMetadataForBreakingSchemaChange(
              breakingSchemaChange,
              schemaCheck.conditionalBreakingChangeMetadata,
            );
          }
        }
      }
    }

    return contractChecks;
  }

  public async getHasSchemaChangesForContractVersion(contractVersion: ContractVersion) {
    return !!(await this.getAllChangesForContractVersion(contractVersion))?.length;
  }

  public async getHasSchemaCompositionErrorsForContractCheck(contractCheck: ContractCheck) {
    return contractCheck.schemaCompositionErrors !== null;
  }

  public async getHasUnapprovedBreakingChangesForContractCheck(contractCheck: ContractCheck) {
    return (
      contractCheck.breakingSchemaChanges?.some(
        change => change.approvalMetadata === null && !change.isSafeBasedOnUsage,
      ) ?? false
    );
  }

  public async getHasSchemaChangesForContractCheck(contractCheck: ContractCheck) {
    return !!(
      contractCheck.breakingSchemaChanges?.length || contractCheck.safeSchemaChanges?.length
    );
  }

  async getContractBaselineForContractCheck(
    contractCheck: ContractCheck,
  ): Promise<GraphQLSchema.ContractCheckBaseline | null> {
    if (
      contractCheck.baselineCompositeSchemaSdl ||
      contractCheck.baselineSupergraphSdl ||
      contractCheck.baselineSchemaCompositionErrors
    ) {
      return {
        publicSdl: contractCheck.baselineCompositeSchemaSdl,
        supergraphSdl: contractCheck.baselineSupergraphSdl,
        compositionErrors: contractCheck.baselineSchemaCompositionErrors,
      };
    }

    const contractVersion = await this.getContractVersionForContractCheck(contractCheck);

    if (!contractVersion) {
      return null;
    }

    return {
      publicSdl: contractVersion.compositeSchemaSdl,
      supergraphSdl: contractVersion.supergraphSdl,
      compositionErrors: contractVersion.schemaCompositionErrors,
    };
  }
}
