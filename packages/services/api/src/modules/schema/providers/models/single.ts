import { Injectable, Scope } from 'graphql-modules';
import type { DangerousChangeType } from '@hive/api/__generated__/types';
import { traceFn } from '@hive/service-common';
import { SchemaChangeType } from '@hive/storage';
import { AppDeployments } from '../../../app-deployments/providers/app-deployments';
import {
  ConditionalBreakingChangeDiffConfig,
  GetAffectedAppDeployments,
  RegistryChecks,
} from '../registry-checks';
import { SingleSchemaInput } from '../schema-helper';
import type { Organization, Project, Target } from './../../../../shared/entities';
import { Logger } from './../../../shared/providers/logger';
import {
  buildSchemaCheckFailureState,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode /* Check */,
  SchemaCheckConclusion,
  SchemaCheckResult /* Publish */,
  SchemaPublishConclusion,
  SchemaPublishResult,
  temp,
} from './shared';

@Injectable({
  scope: Scope.Operation,
})
export class SingleModel {
  constructor(
    private checks: RegistryChecks,
    private logger: Logger,
    private appDeployments: AppDeployments,
  ) {}

  @traceFn('Single modern: diffSchema')
  async diffSchema(args: {
    incoming: Pick<SingleSchemaInput, 'sdl'>;
    existing: Pick<SingleSchemaInput, 'sdl'> | null;
  }) {
    return this.checks.serviceDiff({
      ...args,
      filterNestedChanges: false,
    });
  }

  @traceFn('Single modern: check', {
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
    failDiffOnDangerousChange,
    failAllDangerousChanges,
    failDangerousChangeTypes,
    filterNestedChanges,
  }: {
    input: Pick<SingleSchemaInput, 'sdl'> & {
      baselineSdl: string | null;
    };
    selector: {
      organizationId: string;
      projectId: string;
      targetId: string;
    };
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: [SingleSchemaInput];
    } | null;
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      schemas: [SingleSchemaInput];
    } | null;
    baseSchema: string | null;
    project: Project;
    organization: Organization;
    approvedChanges: Map<string, SchemaChangeType>;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
    failDiffOnDangerousChange: boolean;
    failAllDangerousChanges: boolean;
    failDangerousChangeTypes: DangerousChangeType[];
    filterNestedChanges: boolean;
  }): Promise<SchemaCheckResult> {
    const newSchemaInput: SingleSchemaInput = {
      id: temp,
      sdl: input.sdl,
      metadata: null,
      serviceName: null,
      serviceUrl: null,
    };

    const schemas = [newSchemaInput] as [SingleSchemaInput];

    const baseline = input.baselineSdl ? { ...newSchemaInput, sdl: input.baselineSdl } : null;
    const incoming = {
      schema: newSchemaInput,
      contractNames: null,
    };

    const baselineChecksumResult = baseline
      ? this.checks.checksum({
          existing: {
            schema: baseline,
            contractNames: null,
          },
          incoming,
        })
      : null;

    const registryChecksumResult = this.checks.checksum({
      existing: latest?.schemas[0]
        ? {
            schema: latest.schemas[0],
            contractNames: null,
          }
        : null,
      incoming,
    });

    const baselineMatchesHead = baselineChecksumResult === 'unchanged';
    const registryMatchesHead = registryChecksumResult === 'unchanged';

    if (registryMatchesHead && (!baseline || baselineMatchesHead)) {
      this.logger.info('No changes detected, skipping schema check');
      return {
        conclusion: SchemaCheckConclusion.Skip,
      };
    }

    const [baselineCompositionCheck, compositionCheck] = await Promise.all([
      baseline && !baselineMatchesHead
        ? this.checks.composition({
            targetId: selector.targetId,
            project,
            organization,
            schemas: [baseline],
            baseSchema,
            contracts: null,
          })
        : null,
      this.checks.composition({
        targetId: selector.targetId,
        project,
        organization,
        schemas,
        baseSchema,
        contracts: null,
      }),
    ]);

    const effectiveBaselineCompositionCheck = baselineMatchesHead
      ? compositionCheck
      : baselineCompositionCheck;

    if (effectiveBaselineCompositionCheck?.status === 'failed') {
      return {
        conclusion: SchemaCheckConclusion.Failure,
        reason: {
          baselineComposition: {
            type: 'failure',
            errors: effectiveBaselineCompositionCheck.reason.errors,
            compositeSchemaSDL: effectiveBaselineCompositionCheck.reason.fullSchemaSdl,
            supergraphSDL: null,
          },
          composition:
            compositionCheck.status === 'completed'
              ? {
                  type: 'success',
                  errors: null,
                  compositeSchemaSDL: compositionCheck.result.fullSchemaSdl,
                  supergraphSDL: compositionCheck.result.supergraph,
                }
              : {
                  type: 'failure',
                  errors: compositionCheck.reason.errors,
                  compositeSchemaSDL: compositionCheck.reason.fullSchemaSdl,
                  supergraphSDL: null,
                },
          contracts: null,
          schemaPolicy: null,
          schemaChanges: null,
          serviceSchemaChanges: null,
          supergraphSchemaChanges: null,
        },
      };
    }

    const previousVersionSdl = effectiveBaselineCompositionCheck
      ? effectiveBaselineCompositionCheck.result.fullSchemaSdl
      : await this.checks.retrievePreviousVersionSdl({
          version: latestComposable,
          organization,
          project,
          targetId: selector.targetId,
        });

    const getAffectedAppDeployments: GetAffectedAppDeployments = schemaCoordinates =>
      this.appDeployments.getAffectedAppDeploymentsBySchemaCoordinates({
        targetId: selector.targetId,
        schemaCoordinates,
        excludedAppDeploymentNames:
          conditionalBreakingChangeDiffConfig?.excludedAppDeploymentNames ?? null,
      });

    const [diffCheck, policyCheck] = await Promise.all([
      this.checks.diff({
        conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
        includeUrlChanges: false,
        filterOutFederationChanges: false,
        approvedChanges,
        existingSdl: previousVersionSdl,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        failDiffOnDangerousChange,
        failAllDangerousChanges,
        failDangerousChangeTypes,
        filterNestedChanges,
        getAffectedAppDeployments,
      }),
      this.checks.policyCheck({
        selector,
        modifiedSdl: input.sdl,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
      }),
    ]);

    this.logger.debug('diff check status: %o', diffCheck);
    this.logger.debug('policy check status: %o', policyCheck);

    if (
      compositionCheck.status === 'failed' ||
      diffCheck.status === 'failed' ||
      policyCheck.status === 'failed'
    ) {
      this.logger.info('Schema check failed');

      return {
        conclusion: SchemaCheckConclusion.Failure,
        reason: {
          ...buildSchemaCheckFailureState({
            compositionCheck,
            diffCheck,
            policyCheck,
            contractChecks: null,
          }),
          baselineComposition: effectiveBaselineCompositionCheck
            ? {
                type: 'success',
                errors: null,
                compositeSchemaSDL: effectiveBaselineCompositionCheck.result.fullSchemaSdl,
                supergraphSDL: effectiveBaselineCompositionCheck.result.supergraph,
              }
            : null,
          serviceSchemaChanges: null,
          supergraphSchemaChanges: null,
        },
      };
    }

    this.logger.info('Schema check successful');

    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        baselineComposition: effectiveBaselineCompositionCheck
          ? {
              type: 'success',
              errors: null,
              compositeSchemaSDL: effectiveBaselineCompositionCheck.result.fullSchemaSdl,
              supergraphSDL: effectiveBaselineCompositionCheck.result.supergraph,
            }
          : null,
        schemaChanges: diffCheck.result ?? null,
        serviceSchemaChanges: null,
        supergraphSchemaChanges: null,
        schemaPolicy: policyCheck.result ?? null,
        composition: {
          type: 'success',
          errors: null,
          compositeSchemaSDL: compositionCheck.result.fullSchemaSdl,
          supergraphSDL: compositionCheck.result.supergraph,
        },
        contracts: null,
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
    conditionalBreakingChangeDiffConfig,
    failDiffOnDangerousChange,
    failAllDangerousChanges,
    failDangerousChangeTypes,
  }: {
    input: {
      sdl: string;
      metadata: string | null;
      skipNoChangesCheck: boolean;
    };
    organization: Organization;
    project: Project;
    target: Target;
    latest: {
      isComposable: boolean;
      sdl: string | null;
      schemas: [SingleSchemaInput];
    } | null;
    latestComposable: {
      isComposable: boolean;
      sdl: string | null;
      schemas: [SingleSchemaInput];
    } | null;
    baseSchema: string | null;
    conditionalBreakingChangeDiffConfig: null | ConditionalBreakingChangeDiffConfig;
    failDiffOnDangerousChange: boolean;
    failAllDangerousChanges: boolean;
    failDangerousChangeTypes: DangerousChangeType[];
  }): Promise<SchemaPublishResult> {
    const incoming: SingleSchemaInput = {
      id: temp,
      sdl: input.sdl,
      metadata: input.metadata,
      serviceName: null,
      serviceUrl: null,
    };

    const latestVersion = latest;
    const schemas = [incoming] as [SingleSchemaInput];

    const checksumCheck = this.checks.checksum({
      existing: latest
        ? {
            schema: latest.schemas[0],
            contractNames: null,
          }
        : null,
      incoming: {
        schema: incoming,
        contractNames: null,
      },
    });

    if (checksumCheck === 'unchanged' && !input.skipNoChangesCheck) {
      return {
        conclusion: SchemaPublishConclusion.Ignore,
        reason: PublishIgnoreReasonCode.NoChanges,
      };
    }

    const compositionCheck = await this.checks.composition({
      targetId: target.id,
      project,
      organization,
      baseSchema,
      schemas: [
        baseSchema
          ? {
              ...incoming,
              sdl: baseSchema + ' ' + incoming.sdl,
            }
          : incoming,
      ],
      contracts: null,
    });

    if (
      compositionCheck.status === 'failed' &&
      compositionCheck.reason.errorsBySource.graphql.length > 0
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

    const [metadataCheck, diffCheck] = await Promise.all([
      this.checks.metadata(incoming, latestVersion ? latestVersion.schemas[0] : null),
      this.checks.diff({
        conditionalBreakingChangeConfig: conditionalBreakingChangeDiffConfig,
        filterOutFederationChanges: false,
        includeUrlChanges: false,
        approvedChanges: null,
        existingSdl: previousVersionSdl,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        failDiffOnDangerousChange,
        failAllDangerousChanges,
        failDangerousChangeTypes,
        filterNestedChanges: true, // publish is never associated with schema proposals in this way. So always show the minimal changeset.
        getAffectedAppDeployments: getAffectedAppDeploymentsForPublish,
      }),
    ]);

    if (metadataCheck.status === 'failed') {
      return {
        conclusion: SchemaPublishConclusion.Reject,
        reasons: [
          {
            code: PublishFailureReasonCode.MetadataParsingFailure,
          },
        ],
      };
    }

    const hasNewMetadata =
      metadataCheck.status === 'completed' && metadataCheck.result.status === 'modified';

    const messages: string[] = [];

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
        coordinatesDiff:
          diffCheck.result?.coordinatesDiff ??
          diffCheck.reason?.coordinatesDiff ??
          diffCheck.data?.coordinatesDiff ??
          null,
        supergraphChanges: null,
        previousSchemas: null,
        serviceChanges: null,
        compositionErrors: compositionCheck.reason?.errors ?? null,
        schema: incoming,
        schemas,
        supergraph: null,
        fullSchemaSdl: compositionCheck.result?.fullSchemaSdl ?? null,
        tags: compositionCheck.result?.tags ?? null,
        contracts: null,
        schemaMetadata: compositionCheck.result?.schemaMetadata ?? null,
        metadataAttributes: compositionCheck.result?.metadataAttributes ?? null,
      },
    };
  }
}
