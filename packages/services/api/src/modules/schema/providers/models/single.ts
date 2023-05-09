import { Injectable, Scope } from 'graphql-modules';
import { SingleOrchestrator } from '../orchestrators/single';
import { RegistryChecks } from '../registry-checks';
import type { PublishInput } from '../schema-publisher';
import type { Organization, Project, SingleSchema, Target } from './../../../../shared/entities';
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
  SchemaPublishResult,
  temp,
} from './shared';

@Injectable({
  scope: Scope.Operation,
})
export class SingleModel {
  constructor(
    private orchestrator: SingleOrchestrator,
    private checks: RegistryChecks,
    private logger: Logger,
  ) {}

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
    };
    selector: {
      organization: string;
      project: string;
      target: string;
    };
    latest: {
      isComposable: boolean;
      schemas: [SingleSchema];
    } | null;
    latestComposable: {
      isComposable: boolean;
      schemas: [SingleSchema];
    } | null;
    baseSchema: string | null;
    project: Project;
    organization: Organization;
  }): Promise<SchemaCheckResult> {
    const incoming: SingleSchema = {
      kind: 'single',
      id: temp,
      author: temp,
      commit: temp,
      target: selector.target,
      date: Date.now() as any,
      sdl: input.sdl,
      metadata: null,
    };

    const initial = latest === null;
    const latestVersion = latest;
    const schemas = [incoming] as [SingleSchema];
    const compareToLatest = organization.featureFlags.compareToPreviousComposableVersion === false;

    const checksumCheck = await this.checks.checksum({
      schemas,
      latestVersion,
    });

    // Short-circuit if there are no changes
    if (checksumCheck.status === 'completed' && checksumCheck.result === 'unchanged') {
      this.logger.debug('No changes detected, skipping schema check');
      return {
        conclusion: SchemaCheckConclusion.Success,
        state: {
          changes: null,
          warnings: [],
          initial,
        },
      };
    }

    const [compositionCheck, diffCheck, policyCheck] = await Promise.all([
      this.checks.composition({
        orchestrator: this.orchestrator,
        project,
        schemas,
        baseSchema,
      }),
      this.checks.diff({
        orchestrator: this.orchestrator,
        project,
        schemas,
        selector,
        version: compareToLatest ? latest : latestComposable,
        includeUrlChanges: false,
      }),
      this.checks.policyCheck({
        orchestrator: this.orchestrator,
        project,
        selector,
        schemas,
        modifiedSdl: input.sdl,
      }),
    ]);

    if (
      compositionCheck.status === 'failed' ||
      diffCheck.status === 'failed' ||
      policyCheck.status === 'failed'
    ) {
      const reasons: SchemaCheckFailureReason[] = [];

      if (compositionCheck.status === 'failed') {
        this.logger.debug('Failing schema check due to composition errors');
        reasons.push({
          code: CheckFailureReasonCode.CompositionFailure,
          compositionErrors: compositionCheck.reason.errors,
        });
      }

      if (diffCheck.status === 'failed') {
        this.logger.debug('Failing schema check due to breaking changes');
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

      if (policyCheck.status === 'failed') {
        reasons.push({
          code: CheckFailureReasonCode.PolicyInfringement,
          errors: policyCheck.reason.errors ?? [],
        });
      }

      return {
        conclusion: SchemaCheckConclusion.Failure,
        warnings: policyCheck.reason?.warnings ?? [],
        reasons,
      };
    }

    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        changes: diffCheck.result?.changes ?? null,
        warnings: policyCheck.result?.warnings ?? [],
        initial,
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
    organization: Organization;
    project: Project;
    target: Target;
    latest: {
      isComposable: boolean;
      schemas: [SingleSchema];
    } | null;
    latestComposable: {
      isComposable: boolean;
      schemas: [SingleSchema];
    } | null;
    baseSchema: string | null;
  }): Promise<SchemaPublishResult> {
    const incoming: SingleSchema = {
      kind: 'single',
      id: temp,
      author: input.author,
      sdl: input.sdl,
      commit: input.commit,
      target: target.id,
      date: Date.now() as any,
      metadata: input.metadata ?? null,
    };

    const latestVersion = latest;
    const schemas = [incoming] as [SingleSchema];
    const compareToLatest = organization.featureFlags.compareToPreviousComposableVersion === false;

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

    const [compositionCheck, metadataCheck, diffCheck] = await Promise.all([
      this.checks.composition({
        orchestrator: this.orchestrator,
        project,
        baseSchema,
        schemas: [
          baseSchema
            ? {
                ...incoming,
                sdl: baseSchema + ' ' + incoming.sdl,
              }
            : incoming,
        ],
      }),
      this.checks.metadata(incoming, latestVersion ? latestVersion.schemas[0] : null),
      this.checks.diff({
        orchestrator: this.orchestrator,
        project,
        schemas,
        selector: {
          target: target.id,
          project: project.id,
          organization: project.orgId,
        },
        version: compareToLatest ? latestVersion : latestComposable,
        includeUrlChanges: false,
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
        supergraph: null,
        fullSchemaSdl: compositionCheck.result?.fullSchemaSdl ?? null,
      },
    };
  }
}
