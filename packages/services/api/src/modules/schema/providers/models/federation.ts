// Steps
// - Pre-validation
//   - Ensure service name
//   - Ensure service url
// - Validation and Composition
// - Change detection
// - Conclusion: Publish, Reject, Ignore

// `Publish` means that the schema is published to the registry (either as "available to the gateway" / "composable" or "not available to the gateway" / "not composable")
// `Reject` means that the schema is not published to the registry
// `Ignore` means that the schema is not published to the registry, because it contains no changes

// New V2 model should always accept incoming schema
// which means, it should return either Publish or Ignore

// Old V1 model should return Publish, Reject or Ignore
// Reject incoming schema if it has breaking changes (except when acceptBreakingChanges is true)
// Reject incoming schema if it has composition errors (except when force is true)

// In V2 but also in V1 with acceptBreakingChanges=true, we should skip the usage checking (less pressure on ClickHouse)

import { Injectable, Scope } from 'graphql-modules';
import { FederationOrchestrator } from '../orchestrators/federation';
import { RegistryChecks } from '../registry-checks';
import { swapServices } from '../schema-helper';
import type { PublishInput } from '../schema-publisher';
import type { Project, PushedCompositeSchema, Target } from './../../../../shared/entities';
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
export class FederationModel {
  constructor(private orchestrator: FederationOrchestrator, private checks: RegistryChecks) {}

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
        state: {
          initial,
          changes: null,
        },
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
          compositionErrors: compositionCheck.reason.errors,
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

    const compositionCheck = await this.checks.composition({
      orchestrator: this.orchestrator,
      project,
      schemas,
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

    return {
      conclusion: SchemaPublishConclusion.Publish,
      state: {
        composable: compositionCheck.status === 'completed',
        initial: latestVersion === null,
        changes: null,
        messages:
          serviceUrlCheck?.result?.status === 'modified' ? [serviceUrlCheck.result.message] : [],
        breakingChanges: null,
        compositionErrors: null,
        schema: incoming,
        schemas,
        orchestrator: this.orchestrator,
      },
    };
  }
}
