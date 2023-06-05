import { Injectable, Scope } from 'graphql-modules';
import { SingleOrchestrator } from '../orchestrators/single';
import { RegistryChecks } from '../registry-checks';
import type { PublishInput } from '../schema-publisher';
import type { Project, SingleSchema, Target } from './../../../../shared/entities';
import { Logger } from './../../../shared/providers/logger';
import {
  buildSchemaCheckFailureState,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode,
  /* Check */
  SchemaCheckConclusion,
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
export class SingleLegacyModel {
  constructor(
    private orchestrator: SingleOrchestrator,
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
    baseSchema: string | null;
    project: Project;
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

    const latestVersion = latest;
    const schemas = [incoming] as [SingleSchema];

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
          schemaChanges: null,
          schemaPolicyWarnings: null,
        },
      };
    }

    const [compositionCheck, diffCheck] = await Promise.all([
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
        version: latestVersion,
        includeUrlChanges: false,
      }),
    ]);

    if (compositionCheck.status === 'failed' || diffCheck.status === 'failed') {
      return {
        conclusion: SchemaCheckConclusion.Failure,
        state: buildSchemaCheckFailureState({
          compositionCheck,
          diffCheck,
          policyCheck: null,
        }),
      };
    }

    return {
      conclusion: SchemaCheckConclusion.Success,
      state: {
        schemaChanges: diffCheck.result?.changes ?? null,
        schemaPolicyWarnings: null,
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

    const forced = input.force === true;
    const acceptBreakingChanges = input.experimental_acceptBreakingChanges === true;

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
      this.checks.diff({
        orchestrator: this.orchestrator,
        selector: {
          target: target.id,
          project: project.id,
          organization: project.orgId,
        },
        project,
        schemas,
        version: latestVersion,
        includeUrlChanges: false,
      }),
      this.checks.metadata(incoming, latestVersion ? latestVersion.schemas[0] : null),
    ]);

    const compositionErrors =
      compositionCheck.status === 'failed' ? compositionCheck.reason.errors : null;
    const breakingChanges =
      diffCheck.status === 'failed' && !acceptBreakingChanges
        ? diffCheck.reason.breakingChanges
        : null;
    const changes = diffCheck.result?.changes || diffCheck.reason?.changes || null;

    const hasNewMetadata =
      metadataCheck.status === 'completed' && metadataCheck.result.status === 'modified';
    const hasCompositionErrors = compositionErrors && compositionErrors.length > 0;
    const hasBreakingChanges = breakingChanges && breakingChanges.length > 0;
    const hasErrors = hasCompositionErrors || hasBreakingChanges;

    const shouldBePublished =
      // If there are no errors, we should publish
      !hasErrors ||
      // If there is new metadata, we should publish
      hasNewMetadata ||
      // If there are errors, we should publish if we're forcing
      (hasErrors && forced) ||
      // If there are breaking changes, we should publish if we're accepting breaking changes
      (hasBreakingChanges && acceptBreakingChanges);

    this.logger.debug('!hasErrors: %s', !hasErrors ? 'true' : 'false');
    this.logger.debug('hasErrors && forced: %s', hasErrors && forced ? 'true' : 'false');
    this.logger.debug(
      'hasBreakingChanges && acceptBreakingChanges: %s',
      hasBreakingChanges && acceptBreakingChanges ? 'true' : 'false',
    );

    const messages: string[] = [];

    if (hasNewMetadata) {
      messages.push('Metadata has been updated');
    }

    if (shouldBePublished) {
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
          supergraph: null,
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

    return {
      conclusion: SchemaPublishConclusion.Reject,
      reasons,
    };
  }
}
