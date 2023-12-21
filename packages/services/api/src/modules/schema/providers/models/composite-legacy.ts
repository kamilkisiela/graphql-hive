import { Injectable, Scope } from 'graphql-modules';
import { FederationOrchestrator } from '../orchestrators/federation';
import { StitchingOrchestrator } from '../orchestrators/stitching';
import { RegistryChecks } from '../registry-checks';
import { swapServices } from '../schema-helper';
import type { PublishInput } from '../schema-publisher';
import type {
  Organization,
  Project,
  PushedCompositeSchema,
  Target,
} from './../../../../shared/entities';
import { ProjectType } from './../../../../shared/entities';
import { Logger } from './../../../shared/providers/logger';
import {
  buildSchemaCheckFailureState,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode /* Check */,
  SchemaCheckConclusion,
  SchemaCheckResult /* Publish */,
  SchemaPublishConclusion,
  SchemaPublishFailureReason,
  SchemaPublishResult,
  temp,
} from './shared';

@Injectable({
  scope: Scope.Operation,
})
export class CompositeLegacyModel {
  constructor(
    private federation: FederationOrchestrator,
    private stitching: StitchingOrchestrator,
    private checks: RegistryChecks,
    private logger: Logger,
  ) {}

  async check({
    input,
    selector,
    latest,
    project,
    organization,
    baseSchema,
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
    baseSchema: string | null;
    project: Project;
    organization: Organization;
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
    const orchestrator = project.type === ProjectType.FEDERATION ? this.federation : this.stitching;

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

    const compositionCheck = await this.checks.composition({
      orchestrator,
      project,
      organization,
      schemas,
      baseSchema,
      contracts: null,
    });

    const previousVersionSdl = await this.checks.retrievePreviousVersionSdl({
      orchestrator,
      version: latest,
      organization,
      project,
    });

    const diffCheck = await this.checks.diff({
      usageDataSelector: selector,
      includeUrlChanges: false,
      filterOutFederationChanges: project.type === ProjectType.FEDERATION,
      approvedChanges: null,
      existingSdl: previousVersionSdl,
      incomingSdl:
        compositionCheck.result?.fullSchemaSdl ?? compositionCheck.reason?.fullSchemaSdl ?? null,
    });

    if (compositionCheck.status === 'failed' || diffCheck.status === 'failed') {
      return {
        conclusion: SchemaCheckConclusion.Failure,
        state: buildSchemaCheckFailureState({
          compositionCheck,
          diffCheck,
          policyCheck: null,
          contractChecks: null,
        }),
      };
    }

    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        schemaChanges: diffCheck.result ?? null,
        schemaPolicyWarnings: null,
        composition: {
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
    latest,
    project,
    organization,
    baseSchema,
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
    baseSchema: string | null;
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

    const isFederation = project.type === ProjectType.FEDERATION;
    const orchestrator = isFederation ? this.federation : this.stitching;
    const latestVersion = latest;
    const swap = latestVersion ? swapServices(latestVersion.schemas, incoming) : null;
    const previousService = swap?.existing;
    const schemas = swap?.schemas ?? [incoming];

    const forced = input.force === true;
    const acceptBreakingChanges = input.experimental_acceptBreakingChanges === true;

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

    if (
      serviceNameCheck.status === 'failed' ||
      // If this is a federation, we require a service URL
      (isFederation && serviceUrlCheck.status === 'failed')
    ) {
      return {
        conclusion: SchemaPublishConclusion.Reject,
        reasons: [
          ...(serviceNameCheck.status === 'failed'
            ? [
                {
                  code: PublishFailureReasonCode.MissingServiceName,
                },
              ]
            : []),
          ...(serviceUrlCheck.status === 'failed'
            ? [
                {
                  code: PublishFailureReasonCode.MissingServiceUrl,
                },
              ]
            : []),
        ],
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

    const compositionCheck = await this.checks.composition({
      orchestrator,
      project,
      organization,
      schemas,
      baseSchema,
      contracts: null,
    });

    const previousVersionSdl = await this.checks.retrievePreviousVersionSdl({
      orchestrator,
      version: latestVersion,
      organization,
      project,
    });

    const [diffCheck, metadataCheck] = await Promise.all([
      this.checks.diff({
        usageDataSelector: {
          target: target.id,
          project: project.id,
          organization: project.orgId,
        },
        includeUrlChanges: {
          schemasBefore: latestVersion?.schemas ?? [],
          schemasAfter: schemas,
        },
        filterOutFederationChanges: isFederation,
        approvedChanges: null,
        existingSdl: previousVersionSdl,
        incomingSdl: compositionCheck.result?.fullSchemaSdl ?? null,
      }),
      isFederation
        ? {
            status: 'skipped' as const,
          }
        : this.checks.metadata(incoming, previousService ?? null),
    ]);

    const compositionErrors =
      compositionCheck.status === 'failed' ? compositionCheck.reason.errors : null;
    const breakingChanges =
      diffCheck.status === 'failed' && !acceptBreakingChanges ? diffCheck.reason.breaking : null;
    const changes = diffCheck.result?.all || diffCheck.reason?.all || null;

    const hasNewUrl =
      serviceUrlCheck.status === 'completed' && serviceUrlCheck.result.status === 'modified';
    const hasNewMetadata =
      metadataCheck.status === 'completed' && metadataCheck.result.status === 'modified';
    const hasCompositionErrors = compositionErrors && compositionErrors.length > 0;
    const hasBreakingChanges = breakingChanges && breakingChanges.length > 0;
    const hasErrors = hasCompositionErrors || hasBreakingChanges;

    const shouldBePublished =
      // If there are no errors, we should publish
      !hasErrors ||
      // If there is a new url, we should publish
      hasNewUrl ||
      // If there is new metadata, we should publish
      hasNewMetadata ||
      // If there are composition errors or breaking changes, we should publish if we're forcing
      ((hasCompositionErrors || hasBreakingChanges) && forced) ||
      // If there are breaking changes, we should publish if we're accepting breaking changes
      (hasBreakingChanges && acceptBreakingChanges);

    if (shouldBePublished) {
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
          composable: !hasErrors,
          initial: latestVersion === null,
          messages,
          changes,
          breakingChanges: breakingChanges ?? null,
          compositionErrors,
          schema: incoming,
          schemas,
          supergraph: compositionCheck.result?.supergraph ?? null,
          fullSchemaSdl: compositionCheck.result?.fullSchemaSdl ?? null,
          tags: null,
        },
      };
    }

    const reasons: SchemaPublishFailureReason[] = [];

    if (compositionCheck.status === 'failed') {
      reasons.push({
        code: PublishFailureReasonCode.CompositionFailure,
        compositionErrors: compositionCheck.reason.errors,
      });
    }

    if (diffCheck.status === 'failed' && !acceptBreakingChanges) {
      reasons.push({
        code: PublishFailureReasonCode.BreakingChanges,
        changes: diffCheck.reason.all ?? [],
        breakingChanges: diffCheck.reason.breaking ?? [],
      });
    }

    if (metadataCheck.status === 'failed') {
      reasons.push({
        code: PublishFailureReasonCode.MetadataParsingFailure,
      });
    }

    return {
      conclusion: SchemaPublishConclusion.Reject,
      reasons,
    };
  }
}
