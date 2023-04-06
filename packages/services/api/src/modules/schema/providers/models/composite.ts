import { Injectable, Scope } from 'graphql-modules';
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
  CheckFailureReasonCode,
  DeleteFailureReasonCode,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode,
  /* Check */
  SchemaCheckConclusion,
  SchemaCheckFailureReason,
  SchemaCheckResult,
  /* Delete */
  SchemaDeleteConclusion,
  SchemaDeleteResult,
  /* Publish */
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

  private supportsMetadata(project: Project) {
    return project.type === ProjectType.FEDERATION;
  }

  async check({
    input,
    selector,
    latest,
    latestComposable,
    project,
    organization,
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
    latestComposable: {
      isComposable: boolean;
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
    const compareToLatest = organization.featureFlags.compareToPreviousComposableVersion === false;

    const serviceNameCheck = await this.checks.serviceName({
      name: incoming.service_name,
    });

    if (serviceNameCheck.status === 'failed') {
      return {
        conclusion: SchemaCheckConclusion.Failure,
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
        state: {
          initial,
          changes: null,
        },
      };
    }

    const orchestrator =
      project.type === ProjectType.FEDERATION
        ? this.federationOrchestrator
        : this.stitchingOrchestrator;

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
        version: compareToLatest ? latest : latestComposable,
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
        reasons,
      };
    }

    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        initial,
        changes: diffCheck.result?.changes ?? null,
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
  }: {
    input: PublishInput;
    project: Project;
    organization: Organization;
    target: Target;
    latest: {
      isComposable: boolean;
      schemas: PushedCompositeSchema[];
    } | null;
    latestComposable: {
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
      metadata: this.supportsMetadata(project) ? input.metadata ?? null : null,
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

    const orchestrator =
      project.type === ProjectType.FEDERATION
        ? this.federationOrchestrator
        : this.stitchingOrchestrator;

    const metadataCheck = this.supportsMetadata(project)
      ? await this.checks.metadata(incoming, previousService ?? null)
      : null;

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
        selector: {
          target: target.id,
          project: project.id,
          organization: project.orgId,
        },
        version: compareToLatest ? latest : latestComposable,
      }),
    ]);

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

    if (
      compositionCheck.status === 'failed' &&
      compositionCheck.reason.errorsBySource.graphql.length > 0
    ) {
      if (compareToLatest) {
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
    }

    return {
      conclusion: SchemaPublishConclusion.Publish,
      state: {
        composable: compositionCheck.status === 'completed',
        initial: latestVersion === null,
        changes: diffCheck.result?.changes ?? diffCheck.reason?.changes ?? null,
        messages,
        breakingChanges: null,
        compositionErrors: compositionCheck.reason?.errors ?? null,
        schema: incoming,
        schemas,
        supergraph: compositionCheck.result?.supergraph ?? null,
        fullSchemaSdl: compositionCheck.result?.fullSchemaSdl ?? null,
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
      schemas: PushedCompositeSchema[];
    };
    latestComposable: {
      isComposable: boolean;
      schemas: PushedCompositeSchema[];
    } | null;
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
        version: compareToLatest ? latestVersion : latestComposable,
      }),
    ]);

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
            changes: diffCheck.reason.changes ?? [],
            breakingChanges: diffCheck.reason.breakingChanges ?? [],
          }
        : {
            changes: diffCheck.result?.changes ?? [],
            breakingChanges: [],
          };

    return {
      conclusion: SchemaDeleteConclusion.Accept,
      state: {
        composable: compositionCheck.status === 'completed',
        changes,
        breakingChanges,
        compositionErrors: compositionCheck.reason?.errors ?? [],
      },
    };
  }
}
