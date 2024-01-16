import { Injectable, Scope } from 'graphql-modules';
import { SchemaChangeType } from '@hive/storage';
import { FederationOrchestrator } from '../orchestrators/federation';
import { StitchingOrchestrator } from '../orchestrators/stitching';
import { RegistryChecks } from '../registry-checks';
import { swapServices } from '../schema-helper';
import type { PublishInput } from '../schema-publisher';
import type {
  DeletedCompositeSchema,
  Organization,
  Project,
  PushedCompositeSchema,
  Target,
} from './../../../../shared/entities';
import { ProjectType } from './../../../../shared/entities';
import {
  buildSchemaCheckFailureState,
  ContractCheckInput,
  ContractInput,
  DeleteFailureReasonCode,
  isContractChecksSuccessful,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode /* Check */,
  SchemaCheckConclusion,
  SchemaCheckResult /* Delete */,
  SchemaDeleteConclusion,
  SchemaDeleteResult /* Publish */,
  SchemaPublishConclusion,
  SchemaPublishFailureReason,
  SchemaPublishResult,
  temp,
} from './shared';

@Injectable({
  scope: Scope.Operation,
})
export class CompositeModel {
  constructor(
    private federationOrchestrator: FederationOrchestrator,
    private stitchingOrchestrator: StitchingOrchestrator,
    private checks: RegistryChecks,
  ) {}

  private async getContractChecks(args: {
    contracts: Array<ContractInput> | null;
    compositionCheck: Awaited<ReturnType<RegistryChecks['composition']>>;
    usageDataSelector: {
      organization: string;
      project: string;
      target: string;
    };
    approvedChanges: Map<string, SchemaChangeType> | null;
    compareToPreviousComposableVersion: boolean;
  }): Promise<Array<ContractCheckInput> | null> {
    if (!args.contracts?.length || !args.compositionCheck.result?.contracts?.length) {
      return null;
    }

    const contractResults = args.compositionCheck.result.contracts;
    return await Promise.all(
      args.contracts.map(async (contract, contractIndex) => {
        const contractCompositionResult = contractResults[contractIndex];
        if (!contractCompositionResult) {
          throw new Error("Contract result doesn't exist. Inconsistency detected.");
        }

        return {
          contractId: contract.contract.id,
          contractName: contract.contract.contractName,
          compositionCheck: contractCompositionResult,
          diffCheck: await this.checks.diff({
            usageDataSelector: args.usageDataSelector,
            includeUrlChanges: false,
            // contracts were introduced after this, so we do not need to filter out federation.
            filterOutFederationChanges: false,
            approvedChanges: args.approvedChanges,
            existingSdl:
              (args.compareToPreviousComposableVersion
                ? contract.latestValidVersion?.compositeSchemaSdl
                : contract.latestVersion?.compositeSchemaSdl) ?? null,
            incomingSdl: contractCompositionResult?.result?.fullSchemaSdl ?? null,
          }),
        };
      }),
    );
  }

  async check({
    input,
    selector,
    latest,
    latestComposable,
    project,
    organization,
    baseSchema,
    approvedChanges,
    contracts,
  }: {
    input: {
      sdl: string;
      serviceName: string;
    };
    selector: {
      organization: string;
      project: string;
      target: string;
    };
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
    } | null;
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
    } | null;
    baseSchema: string | null;
    project: Project;
    organization: Organization;
    approvedChanges: Map<string, SchemaChangeType>;
    contracts: Array<ContractInput> | null;
  }): Promise<SchemaCheckResult> {
    const incoming: PushedCompositeSchema = {
      kind: 'composite',
      id: temp,
      author: temp,
      commit: temp,
      target: selector.target,
      date: Date.now() as any,
      sdl: input.sdl,
      service_name: input.serviceName,
      service_url: temp,
      action: 'PUSH',
      metadata: null,
    };

    const latestVersion = latest;
    const schemas = latestVersion
      ? swapServices(latestVersion.schemas, incoming).schemas
      : [incoming];
    const compareToLatest = organization.featureFlags.compareToPreviousComposableVersion === false;

    const checksumCheck = await this.checks.checksum({
      schemas,
      latestVersion,
    });

    // Short-circuit if there are no changes
    if (checksumCheck.status === 'completed' && checksumCheck.result === 'unchanged') {
      return {
        conclusion: SchemaCheckConclusion.Success,
        state: null,
      };
    }

    const orchestrator =
      project.type === ProjectType.FEDERATION
        ? this.federationOrchestrator
        : this.stitchingOrchestrator;

    const compositionCheck = await this.checks.composition({
      orchestrator,
      project,
      organization,
      schemas,
      baseSchema,
      contracts:
        contracts?.map(({ contract }) => ({
          id: contract.id,
          filter: {
            exclude: contract.excludeTags,
            include: contract.includeTags,
            removeUnreachableTypesFromPublicApiSchema:
              contract.removeUnreachableTypesFromPublicApiSchema,
          },
        })) ?? null,
    });

    const previousVersionSdl = await this.checks.retrievePreviousVersionSdl({
      orchestrator,
      version: compareToLatest ? latest : latestComposable,
      organization,
      project,
    });

    const contractChecks = await this.getContractChecks({
      contracts,
      compositionCheck,
      usageDataSelector: selector,
      approvedChanges,
      compareToPreviousComposableVersion:
        organization.featureFlags.compareToPreviousComposableVersion,
    });

    const [diffCheck, policyCheck] = await Promise.all([
      this.checks.diff({
        usageDataSelector: selector,
        includeUrlChanges: false,
        filterOutFederationChanges: project.type === ProjectType.FEDERATION,
        approvedChanges,
        existingSdl: previousVersionSdl,
        incomingSdl:
          compositionCheck.result?.fullSchemaSdl ?? compositionCheck.reason?.fullSchemaSdl ?? null,
      }),
      this.checks.policyCheck({
        selector,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        modifiedSdl: incoming.sdl,
      }),
    ]);

    if (
      compositionCheck.status === 'failed' ||
      diffCheck.status === 'failed' ||
      policyCheck.status === 'failed' ||
      // if any of the contract compositions failed, the schema check failed.
      (contractChecks?.length && !contractChecks.some(isContractChecksSuccessful))
    ) {
      return {
        conclusion: SchemaCheckConclusion.Failure,
        state: buildSchemaCheckFailureState({
          compositionCheck,
          diffCheck,
          policyCheck,
          contractChecks,
        }),
      };
    }

    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        schemaPolicyWarnings: policyCheck.result?.warnings ?? null,
        schemaChanges: diffCheck.result ?? null,
        composition: {
          compositeSchemaSDL: compositionCheck.result.fullSchemaSdl,
          supergraphSDL: compositionCheck.result.supergraph,
        },
        contracts:
          contractChecks?.map(contractCheck => {
            if (!isContractChecksSuccessful(contractCheck)) {
              throw new Error('This should not happen.');
            }

            return {
              contractId: contractCheck.contractId,
              contractName: contractCheck.contractName,
              isSuccessful: true,
              composition: {
                compositeSchemaSDL: contractCheck.compositionCheck.result.fullSchemaSdl,
                supergraphSDL: contractCheck.compositionCheck.result.supergraph ?? null,
              },
              schemaChanges: contractCheck.diffCheck.result ?? null,
            };
          }) ?? null,
      },
    };
  }

  async publish({
    input,
    target,
    project,
    organization,
    latest,
    latestComposable,
    baseSchema,
    contracts,
  }: {
    input: PublishInput;
    project: Project;
    organization: Organization;
    target: Target;
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
    } | null;
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
    } | null;
    baseSchema: string | null;
    contracts: Array<ContractInput> | null;
  }): Promise<SchemaPublishResult> {
    const incoming: PushedCompositeSchema = {
      kind: 'composite',
      id: temp,
      author: input.author,
      sdl: input.sdl,
      commit: input.commit,
      target: target.id,
      date: Date.now() as any,
      service_name: input.service!,
      service_url: input.url!,
      action: 'PUSH',
      metadata: input.metadata ?? null,
    };

    const latestVersion = latest;
    const swap = latestVersion ? swapServices(latestVersion.schemas, incoming) : null;
    const previousService = swap?.existing;
    const schemas = swap?.schemas ?? [incoming];
    const compareToLatest = organization.featureFlags.compareToPreviousComposableVersion === false;

    const [serviceNameCheck, serviceUrlCheck] = await Promise.all([
      this.checks.serviceName({
        name: incoming.service_name,
      }),
      this.checks.serviceUrl(
        {
          url: incoming.service_url,
        },
        previousService
          ? {
              url: previousService.service_url,
            }
          : null,
      ),
    ]);

    if (serviceNameCheck.status === 'failed' || serviceUrlCheck.status === 'failed') {
      const reasons: SchemaPublishFailureReason[] = [];

      if (serviceNameCheck.status === 'failed') {
        reasons.push({
          code: PublishFailureReasonCode.MissingServiceName,
        });
      }

      if (serviceUrlCheck.status === 'failed') {
        reasons.push({
          code: PublishFailureReasonCode.MissingServiceUrl,
        });
      }

      return {
        conclusion: SchemaPublishConclusion.Reject,
        reasons,
      };
    }

    const checksumCheck = await this.checks.checksum({
      schemas,
      latestVersion,
    });

    // Short-circuit if there are no changes
    if (checksumCheck.status === 'completed' && checksumCheck.result === 'unchanged') {
      return {
        conclusion: SchemaPublishConclusion.Ignore,
        reason: PublishIgnoreReasonCode.NoChanges,
      };
    }

    const metadataCheck = await this.checks.metadata(incoming, previousService ?? null);

    if (metadataCheck?.status === 'failed') {
      return {
        conclusion: SchemaPublishConclusion.Reject,
        reasons: [
          {
            code: PublishFailureReasonCode.MetadataParsingFailure,
          },
        ],
      };
    }

    const orchestrator =
      project.type === ProjectType.FEDERATION
        ? this.federationOrchestrator
        : this.stitchingOrchestrator;

    const compositionCheck = await this.checks.composition({
      orchestrator,
      project,
      organization,
      schemas,
      baseSchema,
      contracts:
        contracts?.map(({ contract }) => ({
          id: contract.id,
          filter: {
            exclude: contract.excludeTags,
            include: contract.includeTags,
            removeUnreachableTypesFromPublicApiSchema:
              contract.removeUnreachableTypesFromPublicApiSchema,
          },
        })) ?? null,
    });

    if (
      compositionCheck.status === 'failed' &&
      compositionCheck.reason.errorsBySource.graphql.length > 0 &&
      compareToLatest
    ) {
      return {
        conclusion: SchemaPublishConclusion.Reject,
        reasons: [
          {
            code: PublishFailureReasonCode.CompositionFailure,
            compositionErrors: compositionCheck.reason.errorsBySource.graphql,
          },
        ],
      };
    }

    const schemaVersionToCompareAgainst = compareToLatest ? latest : latestComposable;

    const previousVersionSdl = await this.checks.retrievePreviousVersionSdl({
      orchestrator,
      version: schemaVersionToCompareAgainst,
      organization,
      project,
    });

    const diffCheck = await this.checks.diff({
      usageDataSelector: {
        target: target.id,
        project: project.id,
        organization: project.orgId,
      },
      includeUrlChanges: {
        schemasBefore: schemaVersionToCompareAgainst?.schemas ?? [],
        schemasAfter: schemas,
      },
      filterOutFederationChanges: project.type === ProjectType.FEDERATION,
      approvedChanges: null,
      existingSdl: previousVersionSdl,
      incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
    });

    const usageDataSelector = {
      target: target.id,
      project: project.id,
      organization: project.orgId,
    };

    const contractChecks = await this.getContractChecks({
      contracts,
      compositionCheck,
      usageDataSelector,
      approvedChanges: null,
      compareToPreviousComposableVersion:
        organization.featureFlags.compareToPreviousComposableVersion,
    });

    const hasNewUrl =
      serviceUrlCheck.status === 'completed' && serviceUrlCheck.result.status === 'modified';
    const hasNewMetadata =
      metadataCheck?.status === 'completed' && metadataCheck.result.status === 'modified';

    const messages: string[] = [];

    if (hasNewUrl) {
      messages.push(serviceUrlCheck.result.message!);
    }

    if (hasNewMetadata) {
      messages.push('Metadata has been updated');
    }

    return {
      conclusion: SchemaPublishConclusion.Publish,
      state: {
        composable: compositionCheck.status === 'completed',
        initial: latestVersion === null,
        changes: diffCheck.result?.all ?? diffCheck.reason?.all ?? null,
        messages,
        breakingChanges: null,
        compositionErrors: compositionCheck.reason?.errors ?? null,
        schema: incoming,
        schemas,
        supergraph: compositionCheck.result?.supergraph ?? null,
        fullSchemaSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        tags: compositionCheck.result?.tags ?? null,
        contracts:
          contractChecks?.map(contractCheck => ({
            contractId: contractCheck.contractId,
            contractName: contractCheck.contractName,
            isComposable: contractCheck.compositionCheck.status === 'completed',
            compositionErrors: contractCheck.compositionCheck.reason?.errors ?? null,
            supergraph: contractCheck.compositionCheck?.result?.supergraph ?? null,
            fullSchemaSdl:
              contractCheck.compositionCheck?.result?.fullSchemaSdl ??
              contractCheck.compositionCheck?.reason?.fullSchemaSdl ??
              null,
            changes:
              (contractCheck.diffCheck.result ?? contractCheck.diffCheck.reason)?.all ?? null,
          })) ?? null,
      },
    };
  }

  async delete({
    input,
    latest,
    latestComposable,
    organization,
    project,
    selector,
    baseSchema,
    contracts,
  }: {
    input: {
      serviceName: string;
    };
    project: Project;
    organization: Organization;
    selector: {
      target: string;
      project: string;
      organization: string;
    };
    baseSchema: string | null;
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
    };
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
    } | null;
    contracts: Array<ContractInput> | null;
  }): Promise<SchemaDeleteResult> {
    const incoming: DeletedCompositeSchema = {
      kind: 'composite',
      id: temp,
      target: selector.target,
      date: Date.now() as any,
      service_name: input.serviceName,
      action: 'DELETE',
    };

    const latestVersion = latest;
    const compareToLatest = organization.featureFlags.compareToPreviousComposableVersion === false;

    const serviceNameCheck = await this.checks.serviceName({
      name: incoming.service_name,
    });

    if (serviceNameCheck.status === 'failed') {
      return {
        conclusion: SchemaDeleteConclusion.Reject,
        reasons: [
          {
            code: DeleteFailureReasonCode.MissingServiceName,
          },
        ],
      };
    }

    const orchestrator =
      project.type === ProjectType.FEDERATION
        ? this.federationOrchestrator
        : this.stitchingOrchestrator;
    const schemas = latestVersion.schemas.filter(s => s.service_name !== input.serviceName);

    const compositionCheck = await this.checks.composition({
      orchestrator,
      project,
      organization,
      schemas,
      baseSchema,
      contracts:
        contracts?.map(({ contract }) => ({
          id: contract.id,
          filter: {
            exclude: contract.excludeTags,
            include: contract.includeTags,
            removeUnreachableTypesFromPublicApiSchema:
              contract.removeUnreachableTypesFromPublicApiSchema,
          },
        })) ?? null,
    });

    const previousVersionSdl = await this.checks.retrievePreviousVersionSdl({
      orchestrator,
      version: compareToLatest ? latest : latestComposable,
      organization,
      project,
    });

    const diffCheck = await this.checks.diff({
      usageDataSelector: selector,
      includeUrlChanges: {
        schemasBefore: latestVersion.schemas,
        schemasAfter: schemas,
      },
      filterOutFederationChanges: project.type === ProjectType.FEDERATION,
      approvedChanges: null,
      existingSdl: previousVersionSdl,
      incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
    });

    const contractChecks = await this.getContractChecks({
      contracts,
      compositionCheck,
      usageDataSelector: selector,
      approvedChanges: null,
      compareToPreviousComposableVersion:
        organization.featureFlags.compareToPreviousComposableVersion,
    });

    if (
      compositionCheck.status === 'failed' &&
      compositionCheck.reason.errorsBySource.graphql.length > 0
    ) {
      if (compareToLatest) {
        return {
          conclusion: SchemaDeleteConclusion.Reject,
          reasons: [
            {
              code: DeleteFailureReasonCode.CompositionFailure,
              compositionErrors: compositionCheck.reason.errorsBySource.graphql,
            },
          ],
        };
      }
    }

    const { changes, breakingChanges } =
      diffCheck.status === 'failed'
        ? {
            changes: diffCheck.reason.all ?? [],
            breakingChanges: diffCheck.reason.breaking ?? [],
          }
        : {
            changes: diffCheck.result?.all ?? [],
            breakingChanges: [],
          };

    let composablePartial:
      | {
          composable: true;
          fullSchemaSdl: string;
        }
      | {
          composable: false;
          fullSchemaSdl: null;
        } = {
      composable: false,
      fullSchemaSdl: null,
    };

    const isComposable = compositionCheck.status === 'completed';
    const fullSchemaSdl = compositionCheck.result?.fullSchemaSdl ?? null;

    if (compositionCheck.status === 'completed' && isComposable && fullSchemaSdl == null) {
      throw new Error(
        'Full schema SDL is null when composition check is completed and is composable.',
      );
    } else if (isComposable && fullSchemaSdl) {
      composablePartial = {
        composable: isComposable,
        fullSchemaSdl,
      };
    }

    return {
      conclusion: SchemaDeleteConclusion.Accept,
      state: {
        ...composablePartial,
        changes,
        breakingChanges,
        compositionErrors: compositionCheck.reason?.errors ?? [],
        supergraph: compositionCheck.result?.supergraph ?? null,
        tags: compositionCheck.result?.tags ?? null,
        contracts:
          contractChecks?.map(contractCheck => ({
            contractId: contractCheck.contractId,
            contractName: contractCheck.contractName,
            isComposable: contractCheck.compositionCheck.status === 'completed',
            compositionErrors: contractCheck.compositionCheck.reason?.errors ?? null,
            supergraph: contractCheck.compositionCheck?.result?.supergraph ?? null,
            fullSchemaSdl:
              contractCheck.compositionCheck?.result?.fullSchemaSdl ??
              contractCheck.compositionCheck?.reason?.fullSchemaSdl ??
              null,
            changes:
              (contractCheck.diffCheck.result ?? contractCheck.diffCheck.reason)?.all ?? null,
          })) ?? null,
      },
    };
  }
}
