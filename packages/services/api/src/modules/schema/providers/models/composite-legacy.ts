import { Injectable, Scope } from 'graphql-modules';
import { FederationOrchestrator } from '../orchestrators/federation';
import { StitchingOrchestrator } from '../orchestrators/stitching';
import { RegistryChecks } from '../registry-checks';
import { swapServices } from '../schema-helper';
import type { PublishInput } from '../schema-publisher';
import type { Project, PushedCompositeSchema, Target } from './../../../../shared/entities';
import { ProjectType } from './../../../../shared/entities';
import { Logger } from './../../../shared/providers/logger';
import {
  CheckFailureReasonCode,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode,
  /* Check */
  SchemaCheckConclusion,
  SchemaCheckFailureReason,
  SchemaCheckResult,
  /* Publish */
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
    baseSchema,
  }: {
    input: {
      sdl: string;
      serviceName?: string | null;
    };
    selector: {
      organization: string;
      project: string;
      target: string;
    };
    latest: {
      isComposable: boolean;
      schemas: PushedCompositeSchema[];
    } | null;
    baseSchema: string | null;
    project: Project;
  }): Promise<SchemaCheckResult> {
    const incoming: PushedCompositeSchema = {
      kind: 'composite',
      id: temp,
      author: temp,
      commit: temp,
      target: selector.target,
      date: Date.now() as any,
      sdl: input.sdl,
      service_name: input.serviceName!,
      service_url: temp,
      action: 'PUSH',
      metadata: null,
    };

    const latestVersion = latest;
    const schemas = latestVersion
      ? swapServices(latestVersion.schemas, incoming).schemas
      : [incoming];
    const initial = latest === null;
    const orchestrator = project.type === ProjectType.FEDERATION ? this.federation : this.stitching;

    const serviceNameCheck = await this.checks.serviceName({
      name: incoming.service_name,
    });

    if (serviceNameCheck.status === 'failed') {
      return {
        conclusion: SchemaCheckConclusion.Failure,
        // Do we want to use this new "warning" field to let users know they should upgrade to new model?
        warnings: [],
        reasons: [
          {
            code: CheckFailureReasonCode.MissingServiceName,
          },
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
        conclusion: SchemaCheckConclusion.Success,
        state: { initial, changes: null, warnings: null },
      };
    }

    const [compositionCheck, diffCheck] = await Promise.all([
      this.checks.composition({
        orchestrator,
        project,
        schemas,
        baseSchema,
      }),
      this.checks.diff({
        orchestrator,
        project,
        schemas,
        selector,
        version: latestVersion,
        includeUrlChanges: false,
      }),
    ]);

    if (compositionCheck.status === 'failed' || diffCheck.status === 'failed') {
      const reasons: SchemaCheckFailureReason[] = [];

      if (compositionCheck.status === 'failed') {
        reasons.push({
          code: CheckFailureReasonCode.CompositionFailure,
          compositionErrors: compositionCheck.reason.errors,
        });
      }

      if (diffCheck.status === 'failed') {
        if (diffCheck.reason.changes) {
          reasons.push({
            code: CheckFailureReasonCode.BreakingChanges,
            changes: diffCheck.reason.changes ?? [],
            breakingChanges: diffCheck.reason.breakingChanges,
          });
        }

        if (diffCheck.reason.compareFailure) {
          reasons.push({
            code: CheckFailureReasonCode.CompositionFailure,
            compositionErrors: [diffCheck.reason.compareFailure],
          });
        }
      }

      return {
        conclusion: SchemaCheckConclusion.Failure,
        warnings: [],
        reasons,
      };
    }

    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        initial,
        changes: diffCheck.result?.changes ?? null,
        warnings: null,
      },
    };
  }

  async publish({
    input,
    target,
    latest,
    project,
    baseSchema,
  }: {
    input: PublishInput;
    project: Project;
    target: Target;
    latest: {
      isComposable: boolean;
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

    const [compositionCheck, diffCheck, metadataCheck] = await Promise.all([
      this.checks.composition({
        orchestrator,
        project,
        schemas,
        baseSchema,
      }),
      this.checks.diff({
        orchestrator,
        selector: {
          target: target.id,
          project: project.id,
          organization: project.orgId,
        },
        project,
        schemas,
        version: latestVersion,
        includeUrlChanges: true,
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
      diffCheck.status === 'failed' && !acceptBreakingChanges
        ? diffCheck.reason.breakingChanges
        : null;
    const changes = diffCheck.result?.changes || diffCheck.reason?.changes || null;

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
        changes: diffCheck.reason.changes ?? [],
        breakingChanges: diffCheck.reason.breakingChanges ?? [],
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
