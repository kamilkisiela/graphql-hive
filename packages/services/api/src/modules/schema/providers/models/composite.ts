import { Injectable, Scope } from 'graphql-modules';
import type { DangerousChangeType } from '@hive/api/__generated__/types';
import type { ContractsInputType } from '@hive/schema';
import { invariant, traceFn } from '@hive/service-common';
import { SchemaChangeType } from '@hive/storage';
import { AppDeployments } from '../../../app-deployments/providers/app-deployments';
import {
  GetAffectedAppDeployments,
  RegistryChecks,
  type ConditionalBreakingChangeDiffConfig,
} from '../registry-checks';
import { CompositeSchemaInput, swapServices } from '../schema-helper';
import type { Organization, Project, Target } from './../../../../shared/entities';
import { ProjectType } from './../../../../shared/entities';
import { Logger } from './../../../shared/providers/logger';
import {
  ContractInput,
  ContractStateFailure,
  ContractStateSuccess,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode,
  SchemaCheckConclusion,
  SchemaCheckResult,
  SchemaDeleteConclusion,
  SchemaDeleteResult,
  SchemaPublishConclusion,
  SchemaPublishResult,
  temp,
  type CompositionState,
} from './shared';

@Injectable({
  scope: Scope.Operation,
})
export class CompositeModel {
  constructor(
    private checks: RegistryChecks,
    private logger: Logger,
    private appDeployments: AppDeployments,
  ) {}

  private async getContractCheckStates(args: {
    contracts: Array<
      ContractInput & {
        baselineComposition?: null | CompositionState;
        approvedChanges?: Map<string, SchemaChangeType> | null;
      }
    > | null;
    compositionCheck: Awaited<ReturnType<RegistryChecks['composition']>>;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
    failDiffOnDangerousChange: null | boolean;
    failAllDangerousChanges: null | boolean;
    failDangerousChangeTypes: null | DangerousChangeType[];
    getAffectedAppDeployments: GetAffectedAppDeployments | null;
    skipDiff: boolean;
  }): Promise<Array<ContractStateSuccess | ContractStateFailure> | null> {
    const contractResults = (args.compositionCheck.result ?? args.compositionCheck.reason)
      ?.contracts;

    if (!args.contracts?.length || !contractResults?.length) {
      return null;
    }

    return await Promise.all(
      args.contracts.map(async (contract, contractIndex) => {
        const contractCompositionResult = contractResults[contractIndex];

        invariant(
          !!contractCompositionResult,
          "Contract result doesn't exist. Inconsistency detected.",
        );

        if (
          contractCompositionResult.status == 'failed' ||
          contract.baselineComposition?.type === 'failure'
        ) {
          return {
            isSuccessful: false,
            contractId: contract.contract.id,
            contractName: contract.contract.contractName,
            baselineComposition: contract.baselineComposition ?? null,
            composition:
              contractCompositionResult.status === 'completed'
                ? {
                    type: 'success',
                    errors: null,
                    compositeSchemaSDL: contractCompositionResult.result.fullSchemaSdl,
                    supergraphSDL: contractCompositionResult.result.supergraph,
                  }
                : {
                    type: 'failure' as const,
                    errors: contractCompositionResult.reason.errors,
                    compositeSchemaSDL: null,
                    supergraphSDL: null,
                  },
            schemaChanges: null,
            supergraphChanges: null,
          };
        }

        const [diffCheck, supergraphDiffCheck] = args.skipDiff
          ? [null, null]
          : await Promise.all([
              this.checks.diff({
                conditionalBreakingChangeConfig: args.conditionalBreakingChangeDiffConfig,
                includeUrlChanges: false,
                // contracts were introduced after this, so we do not need to filter out federation.
                filterOutFederationChanges: false,
                approvedChanges: contract.approvedChanges ?? null,
                existingSdl:
                  /** if the baseline composition is provided we use that one over the latest schema */
                  contract.baselineComposition?.compositeSchemaSDL ??
                  contract.latestValidVersion?.compositeSchemaSdl ??
                  null,
                incomingSdl: contractCompositionResult?.result?.fullSchemaSdl ?? null,
                failDiffOnDangerousChange: args.failDiffOnDangerousChange ?? false,
                failAllDangerousChanges: args.failAllDangerousChanges ?? true,
                failDangerousChangeTypes: args.failDangerousChangeTypes ?? [],
                filterNestedChanges: true,
                getAffectedAppDeployments: args.getAffectedAppDeployments,
              }),
              this.checks.diff({
                existingSdl:
                  contract.baselineComposition?.supergraphSDL ??
                  contract.latestValidVersion?.supergraphSdl ??
                  null,
                incomingSdl: contractCompositionResult?.result?.supergraph ?? null,
                approvedChanges: null,
                conditionalBreakingChangeConfig: null,
                includeUrlChanges: false,
                filterOutFederationChanges: false,
                failDiffOnDangerousChange: false,
                filterNestedChanges: true,
                getAffectedAppDeployments: null,
                failAllDangerousChanges: false,
                failDangerousChangeTypes: [],
              }),
            ]);

        const state = {
          contractId: contract.contract.id,
          contractName: contract.contract.contractName,
          baselineComposition: contract.baselineComposition ?? null,
          composition: {
            type: 'success' as const,
            errors: null,
            compositeSchemaSDL: contractCompositionResult.result.fullSchemaSdl,
            supergraphSDL: contractCompositionResult.result.supergraph,
          },
          schemaChanges: diffCheck?.result ?? diffCheck?.reason ?? null,
          supergraphChanges: supergraphDiffCheck?.result ?? supergraphDiffCheck?.reason ?? null,
        };

        if (diffCheck?.status === 'failed') {
          return {
            ...state,
            isSuccessful: false as const,
          };
        }

        return {
          ...state,
          isSuccessful: true as const,
        };
      }),
    );
  }

  @traceFn('Composite modern: diffSchema')
  async diffSchema(args: {
    existing: Array<Pick<CompositeSchemaInput, 'sdl' | 'serviceName'>> | null;
    input: Pick<CompositeSchemaInput, 'sdl' | 'serviceName'>;
  }) {
    return this.checks.serviceDiff({
      existing:
        args.existing?.find(schema => schema.serviceName === args.input.serviceName) ?? null,
      incoming: args.input,
    });
  }

  @traceFn('Composite modern: check', {
    initAttributes: args => ({
      'hive.project.id': args.selector.projectId,
      'hive.target.id': args.selector.targetId,
      'hive.organization.id': args.selector.organizationId,
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
    failDiffOnDangerousChange,
    failAllDangerousChanges,
    failDangerousChangeTypes,
    filterNestedChanges,
  }: {
    input: Pick<CompositeSchemaInput, 'sdl' | 'serviceName'> & {
      /** The baseline SDL that should be used instead of the current service schema. */
      baselineSdl: string | null;
      /** for a schema check the service url is optional */
      serviceUrl: string | null;
    };
    selector: {
      organizationId: string;
      projectId: string;
      targetId: string;
    };
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: CompositeSchemaInput[];
      contractNames: string[] | null;
    } | null;
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      schemas: CompositeSchemaInput[];
    } | null;
    baseSchema: string | null;
    project: Project;
    organization: Organization;
    approvedChanges: Map<string, SchemaChangeType>;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
    failDiffOnDangerousChange: null | boolean;
    failAllDangerousChanges: null | boolean;
    failDangerousChangeTypes: null | DangerousChangeType[];
    contracts: Array<
      ContractInput & {
        approvedChanges: Map<string, SchemaChangeType> | null;
      }
    > | null;
    filterNestedChanges: boolean;
  }): Promise<SchemaCheckResult> {
    const incoming: CompositeSchemaInput = {
      id: temp,
      sdl: input.sdl,
      serviceName: input.serviceName,
      serviceUrl:
        input.serviceUrl ??
        latest?.schemas?.find(s => s.serviceName === input.serviceName)?.serviceUrl ??
        temp,
      metadata: null,
    };

    const schemaSwapResult = latest ? swapServices(latest.schemas, incoming) : null;
    const schemas = schemaSwapResult ? schemaSwapResult.schemas : [incoming];
    schemas.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

    const contractNames = contracts?.map(({ contract }) => contract.contractName) ?? null;
    const baseline = input.baselineSdl ? { ...incoming, sdl: input.baselineSdl } : null;

    const incomingChecksumInput = {
      schema: incoming,
      contractNames,
    };

    // These comparisons answer different questions:
    // - baseline -> head determines whether composition and schema diff work can be deduplicated.
    // - registry -> head determines whether the latest registry artifacts can be reused entirely.
    const baselineChecksumCheck = baseline
      ? this.checks.checksum({
          existing: {
            schema: baseline,
            contractNames,
          },
          incoming: incomingChecksumInput,
        })
      : null;
    const registryChecksumCheck = this.checks.checksum({
      existing: schemaSwapResult?.existing
        ? {
            schema: schemaSwapResult.existing,
            contractNames: latest?.contractNames ?? null,
          }
        : null,
      incoming: incomingChecksumInput,
    });

    const baselineMatchesHead = baselineChecksumCheck === 'unchanged';
    const registryMatchesHead = registryChecksumCheck === 'unchanged';

    // A complete skip is safe only when the registry, baseline (if supplied), and head represent
    // the same service and contract state. Otherwise registry composition artifacts could describe
    // a graph that was never represented by the explicit baseline.
    if (registryMatchesHead && (!baseline || baselineMatchesHead)) {
      this.logger.info('No changes detected, skipping schema check');
      return {
        conclusion: SchemaCheckConclusion.Skip,
      };
    }

    const contractCompositionInput: ContractsInputType | null =
      contracts?.map(({ contract }) => ({
        id: contract.id,
        filter: {
          exclude: contract.excludeTags,
          include: contract.includeTags,
          removeUnreachableTypesFromPublicApiSchema:
            contract.removeUnreachableTypesFromPublicApiSchema,
        },
      })) ?? null;

    let baselineCompositionCheck$ = null;

    if (baseline) {
      if (baselineMatchesHead) {
        this.logger.debug('baseline matches head state. skip composing baseline');
      } else {
        this.logger.debug('baseline service schema provided. composing baseline graph');

        const schemas = latest?.schemas?.filter(s => s.serviceName !== input.serviceName) ?? [];
        schemas.push(baseline);
        schemas.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

        baselineCompositionCheck$ = this.checks.composition({
          targetId: selector.targetId,
          project,
          organization,
          schemas,
          baseSchema,
          contracts: contractCompositionInput,
        });
      }
    }

    // Equal baseline and head snapshots only need one composition. This still must run when they
    // differ from the registry because current composition, policy, and contract checks apply.
    const [composedBaseline, compositionCheck] = await Promise.all([
      baselineCompositionCheck$,
      this.checks.composition({
        targetId: selector.targetId,
        project,
        organization,
        schemas,
        baseSchema,
        contracts: contractCompositionInput,
      }),
    ]);
    const baselineCompositionCheck = baselineMatchesHead ? compositionCheck : composedBaseline;

    // Without a valid baseline composition there is no schema to diff against.
    if (baselineCompositionCheck?.status === 'failed') {
      return {
        conclusion: SchemaCheckConclusion.Failure,
        reason: {
          baselineComposition: {
            type: 'failure',
            errors: baselineCompositionCheck.reason.errors,
            compositeSchemaSDL: baselineCompositionCheck.reason.fullSchemaSdl,
            supergraphSDL: null,
          },
          composition:
            compositionCheck.status === 'completed'
              ? {
                  type: 'success',
                  compositeSchemaSDL: compositionCheck.result.fullSchemaSdl,
                  supergraphSDL: compositionCheck.result.supergraph!,
                  errors: null,
                }
              : {
                  type: 'failure',
                  compositeSchemaSDL: null,
                  supergraphSDL: null,
                  errors: compositionCheck.reason.errors,
                },
          // we do not care about contracts in this case as the main graph composition failed
          contracts: null,
          schemaPolicy: null,
          schemaChanges: null,
        },
      };
    }

    let existingPublicSchemaSdl: string | null;

    // If no baseline composition exists, retrieve the SDL of the latest composable schema version.
    if (!baselineCompositionCheck) {
      existingPublicSchemaSdl = await this.checks.retrievePreviousVersionSdl({
        version: latestComposable,
        organization,
        project,
        targetId: selector.targetId,
      });
    } else {
      // Use the baseline schema composition result for the diff check
      existingPublicSchemaSdl = baselineCompositionCheck.result.fullSchemaSdl;
      invariant(
        baselineCompositionCheck.result.contracts?.length === contracts?.length,
        'There should be the same amount of contracts',
      );
    }

    const getAffectedAppDeployments: GetAffectedAppDeployments = schemaCoordinates =>
      this.appDeployments.getAffectedAppDeploymentsBySchemaCoordinates({
        targetId: selector.targetId,
        schemaCoordinates,
        excludedAppDeploymentNames:
          conditionalBreakingChangeDiffConfig?.excludedAppDeploymentNames ?? null,
      });

    const [diffCheck, policyCheck, contractChecks] = await Promise.all([
      this.checks.diff({
        includeUrlChanges: false,
        filterOutFederationChanges: project.type === ProjectType.FEDERATION,
        approvedChanges,
        existingSdl: existingPublicSchemaSdl,
        incomingSdl:
          compositionCheck.result?.fullSchemaSdl ?? compositionCheck.reason?.fullSchemaSdl ?? null,
        conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
        failDiffOnDangerousChange: failDiffOnDangerousChange ?? false,
        failAllDangerousChanges: failAllDangerousChanges ?? true,
        failDangerousChangeTypes: failDangerousChangeTypes ?? [],
        filterNestedChanges,
        getAffectedAppDeployments,
      }),
      this.checks.policyCheck({
        selector,
        // if schema check does not compose then there's no point in linting. Pass in null in this case.
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        modifiedSdl: incoming.sdl,
      }),
      this.getContractCheckStates({
        contracts:
          contracts?.map((contract, index) => ({
            contract: contract.contract,
            baselineComposition: baselineCompositionCheck?.result.contracts?.[index]
              ? baselineCompositionCheck?.result.contracts?.[index].status === 'completed'
                ? {
                    type: 'success',
                    errors: null,
                    compositeSchemaSDL:
                      baselineCompositionCheck.result.contracts[index].result.fullSchemaSdl,
                    supergraphSDL:
                      baselineCompositionCheck.result.contracts[index].result.supergraph,
                  }
                : {
                    type: 'failure',
                    errors: baselineCompositionCheck.result.contracts[index].reason.errors,
                    compositeSchemaSDL: null,
                    supergraphSDL: null,
                  }
              : null,
            latestValidVersion: contract.latestValidVersion,
            approvedChanges: contract.approvedChanges,
          })) ?? null,
        compositionCheck,
        conditionalBreakingChangeDiffConfig,
        failDiffOnDangerousChange,
        failAllDangerousChanges,
        failDangerousChangeTypes,
        getAffectedAppDeployments,
        skipDiff: baselineMatchesHead,
      }),
    ]);
    this.logger.debug('diff check status: %o', diffCheck);
    this.logger.debug('policy check status: %o', policyCheck);

    if (
      compositionCheck.status === 'failed' ||
      diffCheck.status === 'failed' ||
      policyCheck.status === 'failed' ||
      // if any of the contract compositions failed
      // OR any contract for the baseline failed
      contractChecks?.some(check => !check.isSuccessful)
    ) {
      this.logger.info('Schema check failed');
      return {
        conclusion: SchemaCheckConclusion.Failure,
        reason: {
          baselineComposition: baselineCompositionCheck
            ? {
                type: 'success',
                errors: null,
                supergraphSDL: baselineCompositionCheck.result.supergraph,
                compositeSchemaSDL: baselineCompositionCheck.result.fullSchemaSdl,
              }
            : null,
          composition:
            compositionCheck.status === 'completed'
              ? {
                  type: 'success',
                  compositeSchemaSDL: compositionCheck.result.fullSchemaSdl,
                  supergraphSDL: compositionCheck.result.supergraph,
                  errors: null,
                }
              : {
                  type: 'failure',
                  compositeSchemaSDL: compositionCheck.reason.fullSchemaSdl,
                  supergraphSDL: null,
                  errors: compositionCheck.reason.errors,
                },
          schemaPolicy: policyCheck.result ?? policyCheck.reason ?? null,
          schemaChanges: diffCheck.reason ?? diffCheck.result ?? null,
          contracts: contractChecks,
        },
      };
    }

    this.logger.info('Schema check successful');
    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        baselineComposition: baselineCompositionCheck
          ? {
              type: 'success',
              errors: null,
              compositeSchemaSDL: baselineCompositionCheck.result.fullSchemaSdl,
              supergraphSDL: baselineCompositionCheck.result.supergraph,
            }
          : null,
        composition: {
          type: 'success',
          compositeSchemaSDL: compositionCheck.result.fullSchemaSdl,
          supergraphSDL: compositionCheck.result.supergraph,
          errors: null,
        },
        schemaPolicy: policyCheck.result ?? null,
        schemaChanges: diffCheck.result ?? null,

        contracts:
          contractChecks?.map(contractCheck => {
            invariant(contractCheck.isSuccessful, 'Successful check has failed contract.');
            return contractCheck;
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
    failDiffOnDangerousChange,
    failAllDangerousChanges,
    failDangerousChangeTypes,
  }: {
    input: {
      sdl: string;
      service: string;
      url: string | null;
      metadata: string | null;
      skipNoChangesCheck: boolean;
    };
    project: Project;
    organization: Organization;
    target: Target;
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: CompositeSchemaInput[];
      contractNames: string[] | null;
    } | null;
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      supergraphSdl: string | null;
      schemas: CompositeSchemaInput[];
    } | null;
    baseSchema: string | null;
    contracts: Array<ContractInput> | null;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
    failDiffOnDangerousChange: null | boolean;
    failAllDangerousChanges: null | boolean;
    failDangerousChangeTypes: null | DangerousChangeType[];
  }): Promise<SchemaPublishResult> {
    const latestSchemaVersion = latest;
    const latestServiceVersion = latest?.schemas?.find(
      schema => schema.serviceName === input.service,
    );

    const serviceUrlCheck = await this.checks.serviceUrl(
      input.url ?? null,
      latestServiceVersion?.serviceUrl ?? null,
    );

    if (serviceUrlCheck.status === 'failed') {
      return {
        conclusion: SchemaPublishConclusion.Reject,
        reasons: [
          {
            code: PublishFailureReasonCode.MissingServiceUrl,
          },
        ],
      };
    }

    const incoming: CompositeSchemaInput = {
      id: temp,
      sdl: input.sdl,
      serviceName: input.service,
      serviceUrl: serviceUrlCheck.result.serviceUrl,
      metadata: input.metadata ?? null,
    };

    const schemaSwapResult = latestSchemaVersion
      ? swapServices(latestSchemaVersion.schemas, incoming)
      : null;
    const previousService = schemaSwapResult?.existing;

    const schemas = schemaSwapResult?.schemas ?? [incoming];
    schemas.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

    const checksumCheck = this.checks.checksum({
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

    if (checksumCheck === 'unchanged' && !input.skipNoChangesCheck) {
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

    const compositionCheck = await this.checks.composition({
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
      (compositionCheck.reason.includesNetworkError || compositionCheck.reason.includesException)
    ) {
      return {
        conclusion: SchemaPublishConclusion.Reject,
        reasons: [
          {
            code: PublishFailureReasonCode.CompositionFailure,
            compositionErrors: compositionCheck.reason.errorsBySource.composition,
          },
        ],
      };
    }

    const previousVersionSdl = await this.checks.retrievePreviousVersionSdl({
      version: latestComposable,
      organization,
      project,
      targetId: target.id,
    });

    const getAffectedAppDeploymentsForPublish: GetAffectedAppDeployments = schemaCoordinates =>
      this.appDeployments.getAffectedAppDeploymentsBySchemaCoordinates({
        targetId: target.id,
        schemaCoordinates,
        excludedAppDeploymentNames:
          conditionalBreakingChangeDiffConfig?.excludedAppDeploymentNames ?? null,
      });

    const [diffCheck, serviceDiffCheck, supergraphDiffCheck, contractChecks] = await Promise.all([
      this.checks.diff({
        conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
        includeUrlChanges: {
          schemasBefore: latestComposable?.schemas ?? [],
          schemasAfter: schemas,
        },
        filterOutFederationChanges: project.type === ProjectType.FEDERATION,
        approvedChanges: null,
        existingSdl: previousVersionSdl,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        failDiffOnDangerousChange: failDiffOnDangerousChange ?? false,
        failAllDangerousChanges: failAllDangerousChanges ?? true,
        failDangerousChangeTypes: failDangerousChangeTypes ?? [],
        filterNestedChanges: true, // filter because publish is never associated to schema proposals in this way.
        getAffectedAppDeployments: getAffectedAppDeploymentsForPublish,
      }),
      this.checks.diff({
        existingSdl: previousService?.sdl ?? null,
        incomingSdl: input.sdl,
        approvedChanges: null,
        conditionalBreakingChangeConfig: null,
        includeUrlChanges: false,
        filterOutFederationChanges: false,
        failDiffOnDangerousChange: false,
        filterNestedChanges: true,
        getAffectedAppDeployments: null,
        failAllDangerousChanges: false,
        failDangerousChangeTypes: [],
      }),
      this.checks.diff({
        existingSdl: latestComposable?.supergraphSdl ?? null,
        incomingSdl: compositionCheck.result?.supergraph ?? null,
        approvedChanges: null,
        conditionalBreakingChangeConfig: null,
        includeUrlChanges: false,
        filterOutFederationChanges: false,
        failDiffOnDangerousChange: false,
        filterNestedChanges: true,
        getAffectedAppDeployments: null,
        failAllDangerousChanges: false,
        failDangerousChangeTypes: [],
      }),
      this.getContractCheckStates({
        contracts,
        compositionCheck,
        conditionalBreakingChangeDiffConfig,
        failDiffOnDangerousChange,
        failAllDangerousChanges: false,
        failDangerousChangeTypes: [],
        getAffectedAppDeployments: getAffectedAppDeploymentsForPublish,
        skipDiff: false,
      }),
    ]);

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
        initial: latestSchemaVersion === null,
        changes: diffCheck.result?.all ?? diffCheck.reason?.all ?? null,
        serviceChanges: serviceDiffCheck.result?.all ?? serviceDiffCheck.reason?.all ?? null,
        supergraphChanges:
          supergraphDiffCheck.result?.all ?? supergraphDiffCheck.reason?.all ?? null,
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
        previousSchemas: latest?.schemas ?? null,
        supergraph: compositionCheck.result?.supergraph ?? null,
        fullSchemaSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        tags: compositionCheck.result?.tags ?? null,
        schemaMetadata: compositionCheck.result?.schemaMetadata ?? null,
        metadataAttributes: compositionCheck.result?.metadataAttributes ?? null,
        contracts:
          contractChecks?.map(contractCheck => ({
            contractId: contractCheck.contractId,
            contractName: contractCheck.contractName,
            isComposable: contractCheck.composition.type === 'success',
            compositionErrors: contractCheck.composition.errors ?? null,
            supergraph: contractCheck.composition.supergraphSDL ?? null,
            fullSchemaSdl: contractCheck.composition.compositeSchemaSDL ?? null,
            changes: contractCheck.schemaChanges?.all ?? null,
            supergraphChanges: contractCheck.supergraphChanges?.all ?? null,
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
    failDiffOnDangerousChange,
    failAllDangerousChanges,
    failDangerousChangeTypes,
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
      schemas: CompositeSchemaInput[];
    };
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      supergraphSdl: string | null;
      schemas: CompositeSchemaInput[];
    } | null;
    contracts: Array<ContractInput> | null;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
    failDiffOnDangerousChange: null | boolean;
    failAllDangerousChanges: null | boolean;
    failDangerousChangeTypes: null | DangerousChangeType[];
  }): Promise<SchemaDeleteResult> {
    const latestVersion = latest;

    const schemas = latestVersion.schemas.filter(s => s.serviceName !== input.serviceName);
    schemas.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

    const compositionCheck = await this.checks.composition({
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
      version: latestComposable,
      organization,
      project,
      targetId: selector.target,
    });

    const getAffectedAppDeploymentsForDelete: GetAffectedAppDeployments = schemaCoordinates =>
      this.appDeployments.getAffectedAppDeploymentsBySchemaCoordinates({
        targetId: selector.target,
        schemaCoordinates,
        excludedAppDeploymentNames:
          conditionalBreakingChangeDiffConfig?.excludedAppDeploymentNames ?? null,
      });

    const [diffCheck, contractChecks, supergraphDiffCheck] = await Promise.all([
      this.checks.diff({
        conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
        includeUrlChanges: {
          schemasBefore: latestVersion.schemas,
          schemasAfter: schemas,
        },
        filterOutFederationChanges: project.type === ProjectType.FEDERATION,
        approvedChanges: null,
        existingSdl: previousVersionSdl,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        failDiffOnDangerousChange: failDiffOnDangerousChange ?? false,
        failAllDangerousChanges: failAllDangerousChanges ?? true,
        failDangerousChangeTypes: failDangerousChangeTypes ?? [],
        filterNestedChanges: true, // filter because deletes are never associated with schema proposals in this way.
        getAffectedAppDeployments: getAffectedAppDeploymentsForDelete,
      }),
      this.getContractCheckStates({
        contracts,
        compositionCheck,
        conditionalBreakingChangeDiffConfig,
        failDiffOnDangerousChange,
        failAllDangerousChanges: failAllDangerousChanges ?? true,
        failDangerousChangeTypes: failDangerousChangeTypes ?? [],
        getAffectedAppDeployments: getAffectedAppDeploymentsForDelete,
        skipDiff: false,
      }),
      this.checks.diff({
        existingSdl: latestComposable?.supergraphSdl ?? null,
        incomingSdl: compositionCheck.result?.supergraph ?? null,
        approvedChanges: null,
        conditionalBreakingChangeConfig: null,
        includeUrlChanges: false,
        filterOutFederationChanges: false,
        failDiffOnDangerousChange: false,
        filterNestedChanges: true,
        getAffectedAppDeployments: null,
        failAllDangerousChanges: failAllDangerousChanges ?? true,
        failDangerousChangeTypes: failDangerousChangeTypes ?? [],
      }),
    ]);

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
        supergraphChanges:
          supergraphDiffCheck.result?.all ?? supergraphDiffCheck.reason?.all ?? null,
        tags: compositionCheck.result?.tags ?? null,
        schemaMetadata: compositionCheck.result?.schemaMetadata ?? null,
        metadataAttributes: compositionCheck.result?.metadataAttributes ?? null,
        schemas,
        contracts:
          contractChecks?.map(contractCheck => ({
            contractId: contractCheck.contractId,
            contractName: contractCheck.contractName,
            isComposable: contractCheck.composition.type === 'success',
            compositionErrors: contractCheck.composition.errors,
            supergraph: contractCheck.composition.supergraphSDL,
            fullSchemaSdl: contractCheck.composition.compositeSchemaSDL,
            changes: contractCheck.schemaChanges?.all ?? null,
            supergraphChanges: contractCheck.supergraphChanges?.all ?? null,
          })) ?? null,
      },
    };
  }
}
