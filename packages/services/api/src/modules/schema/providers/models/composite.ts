import { Injectable, Scope } from 'graphql-modules';
import { traceFn } from '@hive/service-common';
import { SchemaChangeType } from '@hive/storage';
import { FederationOrchestrator } from '../orchestrators/federation';
import { StitchingOrchestrator } from '../orchestrators/stitching';
import { RegistryChecks, type ConditionalBreakingChangeDiffConfig } from '../registry-checks';
import { swapServices } from '../schema-helper';
import { shouldUseLatestComposableVersion } from '../schema-manager';
import type { PublishInput } from '../schema-publisher';
import type {
  DeletedCompositeSchema,
  Organization,
  Project,
  PushedCompositeSchema,
  Target,
} from './../../../../shared/entities';
import { ProjectType } from './../../../../shared/entities';
import { Logger } from './../../../shared/providers/logger';
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
    private logger: Logger,
  ) {}

  private async getContractChecks(args: {
    contracts: Array<
      ContractInput & {
        approvedChanges?: Map<string, SchemaChangeType> | null;
      }
    > | null;
    compositionCheck: Awaited<ReturnType<RegistryChecks['composition']>>;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
  }): Promise<Array<ContractCheckInput> | null> {
    const contractResults = (args.compositionCheck.result ?? args.compositionCheck.reason)
      ?.contracts;

    if (!args.contracts?.length || !contractResults?.length) {
      return null;
    }

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
            conditionalBreakingChangeConfig: args.conditionalBreakingChangeDiffConfig,
            includeUrlChanges: false,
            // contracts were introduced after this, so we do not need to filter out federation.
            filterOutFederationChanges: false,
            approvedChanges: contract.approvedChanges ?? null,
            existingSdl: contract.latestValidVersion?.compositeSchemaSdl ?? null,
            incomingSdl: contractCompositionResult?.result?.fullSchemaSdl ?? null,
          }),
        };
      }),
    );
  }

  @traceFn('Composite modern: check', {
    initAttributes: args => ({
      'hive.project.id': args.selector.project,
      'hive.target.id': args.selector.target,
      'hive.organization.id': args.selector.organization,
    }),
  })
  async check({
    input,
    selector,
    latest,
    latestComposable,
    project,
    organization,
    baseSchema,
    approvedChanges,
    conditionalBreakingChangeDiffConfig,
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
      contractNames: string[] | null;
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
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
    contracts: Array<
      ContractInput & {
        approvedChanges: Map<string, SchemaChangeType> | null;
      }
    > | null;
  }): Promise<SchemaCheckResult> {
    const incoming: PushedCompositeSchema = {
      kind: 'composite',
      id: temp,
      author: temp,
      commit: temp,
      target: selector.target,
      date: Date.now(),
      sdl: input.sdl,
      service_name: input.serviceName,
      service_url:
        latest?.schemas?.find(s => s.service_name === input.serviceName)?.service_url ?? 'temp',
      action: 'PUSH',
      metadata: null,
    };

    const schemaSwapResult = latest ? swapServices(latest.schemas, incoming) : null;
    const schemas = schemaSwapResult ? schemaSwapResult.schemas : [incoming];
    schemas.sort((a, b) => a.service_name.localeCompare(b.service_name));

    const compareToPreviousComposableVersion = shouldUseLatestComposableVersion(
      selector.target,
      project,
      organization,
    );
    const comparedVersion = compareToPreviousComposableVersion ? latestComposable : latest;

    const checksumCheck = await this.checks.checksum({
      existing: schemaSwapResult?.existing
        ? {
            schema: schemaSwapResult.existing,
            contractNames: latest?.contractNames ?? null,
          }
        : null,
      incoming: {
        schema: incoming,
        contractNames: contracts?.map(({ contract }) => contract.contractName) ?? null,
      },
    });

    if (checksumCheck === 'unchanged') {
      this.logger.info('No changes detected, skipping schema check');
      return {
        conclusion: SchemaCheckConclusion.Skip,
      };
    }

    const orchestrator =
      project.type === ProjectType.FEDERATION
        ? this.federationOrchestrator
        : this.stitchingOrchestrator;
    this.logger.debug('Orchestrator: %s', orchestrator);

    const compositionCheck = await this.checks.composition({
      orchestrator,
      targetId: selector.target,
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
      version: comparedVersion,
      organization,
      project,
      targetId: selector.target,
    });

    const contractChecks = await this.getContractChecks({
      contracts,
      compositionCheck,
      conditionalBreakingChangeDiffConfig,
    });
    this.logger.info('Contract checks: %o', contractChecks);

    const [diffCheck, policyCheck] = await Promise.all([
      this.checks.diff({
        includeUrlChanges: false,
        filterOutFederationChanges: project.type === ProjectType.FEDERATION,
        approvedChanges,
        existingSdl: previousVersionSdl,
        incomingSdl:
          compositionCheck.result?.fullSchemaSdl ?? compositionCheck.reason?.fullSchemaSdl ?? null,
        conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
      }),
      this.checks.policyCheck({
        selector,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        modifiedSdl: incoming.sdl,
      }),
    ]);
    this.logger.info('diff check status: %o', diffCheck);
    this.logger.info('policy check status: %o', policyCheck);

    if (
      compositionCheck.status === 'failed' ||
      diffCheck.status === 'failed' ||
      policyCheck.status === 'failed' ||
      // if any of the contract compositions failed, the schema check failed.
      (contractChecks?.length && contractChecks.some(check => !isContractChecksSuccessful(check)))
    ) {
      this.logger.debug('Schema check failed');
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

    this.logger.debug('Schema check successful');
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
    conditionalBreakingChangeDiffConfig,
  }: {
    input: PublishInput;
    project: Project;
    organization: Organization;
    target: Target;
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
      contractNames: string[] | null;
    } | null;
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      schemas: PushedCompositeSchema[];
    } | null;
    baseSchema: string | null;
    contracts: Array<ContractInput> | null;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
  }): Promise<SchemaPublishResult> {
    const incoming: PushedCompositeSchema = {
      kind: 'composite',
      id: temp,
      author: input.author,
      sdl: input.sdl,
      commit: input.commit,
      target: target.id,
      date: Date.now(),
      service_name: input.service || '',
      service_url: input.url || '',
      action: 'PUSH',
      metadata: input.metadata ?? null,
    };

    const latestVersion = latest;
    const schemaSwapResult = latestVersion ? swapServices(latestVersion.schemas, incoming) : null;
    const previousService = schemaSwapResult?.existing;
    const schemas = schemaSwapResult?.schemas ?? [incoming];
    schemas.sort((a, b) => a.service_name.localeCompare(b.service_name));
    const compareToLatestComposable = shouldUseLatestComposableVersion(
      target.id,
      project,
      organization,
    );
    const schemaVersionToCompareAgainst = compareToLatestComposable ? latestComposable : latest;

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
      existing: schemaSwapResult?.existing
        ? {
            schema: schemaSwapResult.existing,
            contractNames: latest?.contractNames ?? null,
          }
        : null,
      incoming: {
        schema: incoming,
        contractNames: contracts?.map(contract => contract.contract.contractName) ?? null,
      },
    });

    if (checksumCheck === 'unchanged') {
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
      targetId: target.id,
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
      !compareToLatestComposable
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

    const previousVersionSdl = await this.checks.retrievePreviousVersionSdl({
      orchestrator,
      version: schemaVersionToCompareAgainst,
      organization,
      project,
      targetId: target.id,
    });

    const diffCheck = await this.checks.diff({
      conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
      includeUrlChanges: {
        schemasBefore: schemaVersionToCompareAgainst?.schemas ?? [],
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
      conditionalBreakingChangeDiffConfig,
    });

    const messages: string[] = [];

    if (serviceUrlCheck.status === 'completed' && serviceUrlCheck.result.status === 'modified') {
      messages.push(serviceUrlCheck.result.message);
    }

    if (metadataCheck?.status === 'completed' && metadataCheck.result.status === 'modified') {
      messages.push('Metadata has been updated');
    }

    return {
      conclusion: SchemaPublishConclusion.Publish,
      state: {
        composable: compositionCheck.status === 'completed',
        initial: latestVersion === null,
        changes: diffCheck.result?.all ?? diffCheck.reason?.all ?? null,
        coordinatesDiff:
          diffCheck.result?.coordinatesDiff ??
          diffCheck.reason?.coordinatesDiff ??
          diffCheck.data?.coordinatesDiff ??
          null,
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
    conditionalBreakingChangeDiffConfig,
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
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
  }): Promise<SchemaDeleteResult> {
    const incoming: DeletedCompositeSchema = {
      kind: 'composite',
      id: temp,
      target: selector.target,
      date: Date.now(),
      service_name: input.serviceName,
      action: 'DELETE',
    };

    const latestVersion = latest;
    const compareToLatestComposable = shouldUseLatestComposableVersion(
      selector.target,
      project,
      organization,
    );

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
    schemas.sort((a, b) => a.service_name.localeCompare(b.service_name));

    const compositionCheck = await this.checks.composition({
      orchestrator,
      targetId: selector.target,
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
      version: compareToLatestComposable ? latestComposable : latest,
      organization,
      project,
      targetId: selector.target,
    });

    const diffCheck = await this.checks.diff({
      conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
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
      conditionalBreakingChangeDiffConfig,
    });

    if (
      compositionCheck.status === 'failed' &&
      compositionCheck.reason.errorsBySource.graphql.length > 0
    ) {
      if (!compareToLatestComposable) {
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
        coordinatesDiff:
          diffCheck.result?.coordinatesDiff ??
          diffCheck.reason?.coordinatesDiff ??
          diffCheck.data?.coordinatesDiff ??
          null,
        compositionErrors: compositionCheck.reason?.errors ?? [],
        supergraph: compositionCheck.result?.supergraph ?? null,
        tags: compositionCheck.result?.tags ?? null,
        schemas,
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
