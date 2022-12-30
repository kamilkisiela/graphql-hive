import { Injectable, Scope } from 'graphql-modules';
import { FederationOrchestrator } from '../orchestrators/federation';
import { RegistryChecks } from '../registry-checks';
import { swapServices } from '../schema-helper';
import type { PublishInput } from '../schema-publisher';
import type { Project, PushedCompositeSchema, Target } from './../../../../shared/entities';
import { Logger } from './../../../shared/providers/logger';
import {
  CheckFailureReasonCode,
  PublishFailureReasonCode,
  PublishIgnoreReasonCode,
  // Check
  SchemaCheckConclusion,
  SchemaCheckFailureReason,
  SchemaCheckResult,
  // Publish
  SchemaPublishConclusion,
  SchemaPublishFailureReason,
  SchemaPublishResult,
  temp,
} from './shared';

@Injectable({
  scope: Scope.Operation,
})
export class FederationLegacyModel {
  constructor(
    private orchestrator: FederationOrchestrator,
    private checks: RegistryChecks,
    private logger: Logger,
  ) {}

  async check({
    input,
    selector,
    latest,
    project,
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
        state: { initial, changes: null },
      };
    }

    const [compositionCheck, diffCheck] = await Promise.all([
      this.checks.composition({
        orchestrator: this.orchestrator,
        project,
        schemas,
      }),
      this.checks.diff({
        orchestrator: this.orchestrator,
        project,
        schemas,
        selector,
        latestVersion,
      }),
    ]);

    if (compositionCheck.status === 'failed' || diffCheck.status === 'failed') {
      const reasons: SchemaCheckFailureReason[] = [];

      if (compositionCheck.status === 'failed') {
        reasons.push({
          code: CheckFailureReasonCode.CompositionFailure,
          compositionErrors: compositionCheck.reason.allErrors,
        });
      }

      if (diffCheck.status === 'failed') {
        reasons.push({
          code: CheckFailureReasonCode.BreakingChanges,
          changes: diffCheck.reason.changes ?? [],
          breakingChanges: diffCheck.reason.breakingChanges,
        });
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
    latest,
    project,
  }: {
    input: PublishInput;
    project: Project;
    target: Target;
    latest: {
      isComposable: boolean;
      schemas: PushedCompositeSchema[];
    } | null;
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
      metadata: null,
    };

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

    if (serviceNameCheck.status === 'failed' || serviceUrlCheck.status === 'failed') {
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

    const [compositionCheck, diffCheck] = await Promise.all([
      this.checks.composition({
        orchestrator: this.orchestrator,
        project,
        schemas,
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
        latestVersion,
      }),
    ]);

    const compositionErrors =
      compositionCheck.status === 'failed' ? compositionCheck.reason.allErrors : null;
    const breakingChanges =
      diffCheck.status === 'failed' && !acceptBreakingChanges
        ? diffCheck.reason.breakingChanges
        : null;
    const changes = diffCheck.result?.changes || diffCheck.reason?.changes || null;

    const hasNewUrl = serviceUrlCheck.result.status === 'modified';
    const hasCompositionErrors = compositionErrors && compositionErrors.length > 0;
    const hasBreakingChanges = breakingChanges && breakingChanges.length > 0;
    const hasErrors = hasCompositionErrors || hasBreakingChanges;

    this.logger.debug('has new url? %s', hasNewUrl ? 'yes' : 'no');

    const shouldBePublished =
      // If there are no errors, we should publish
      !hasErrors ||
      // If there is a new url, we should publish
      hasNewUrl ||
      // If there are composition errors or breaking changes, we should publish if we're forcing
      ((hasCompositionErrors || hasBreakingChanges) && forced) ||
      // If there are breaking changes, we should publish if we're accepting breaking changes
      (hasBreakingChanges && acceptBreakingChanges);

    if (shouldBePublished) {
      return {
        conclusion: SchemaPublishConclusion.Publish,
        state: {
          composable: !hasErrors,
          initial: latestVersion === null,
          changes,
          messages: hasNewUrl ? [serviceUrlCheck.result.message!] : null,
          breakingChanges,
          compositionErrors,
          schema: incoming,
          schemas,
          orchestrator: this.orchestrator,
        },
      };
    }

    const reasons: SchemaPublishFailureReason[] = [];

    if (compositionCheck.status === 'failed') {
      reasons.push({
        code: PublishFailureReasonCode.CompositionFailure,
        compositionErrors: compositionCheck.reason.allErrors,
      });
    }

    if (diffCheck.status === 'failed' && !acceptBreakingChanges) {
      reasons.push({
        code: PublishFailureReasonCode.BreakingChanges,
        changes: diffCheck.reason.changes ?? [],
        breakingChanges: diffCheck.reason.breakingChanges,
      });
    }

    return {
      conclusion: SchemaPublishConclusion.Reject,
      reasons,
    };
  }
}
