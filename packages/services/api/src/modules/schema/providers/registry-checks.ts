import { URL } from 'node:url';
import type { GraphQLSchema } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import hashObject from 'object-hash';
import { CriticalityLevel } from '@graphql-inspector/core';
import type { CheckPolicyResponse } from '@hive/policy';
import type { CompositionFailureError, ContractsInputType } from '@hive/schema';
import {
  HiveSchemaChangeModel,
  SchemaChangeType,
  type RegistryServiceUrlChangeSerializableChange,
} from '@hive/storage';
import { ProjectType } from '../../../shared/entities';
import { createPeriod } from '../../../shared/helpers';
import { buildSortedSchemaFromSchemaObject } from '../../../shared/schema';
import { OperationsReader } from '../../operations/providers/operations-reader';
import { SchemaPolicyProvider } from '../../policy/providers/schema-policy.provider';
import { Storage } from '../../shared/providers/storage';
import type {
  ComposeAndValidateResult,
  Orchestrator,
  Organization,
  Project,
  PushedCompositeSchema,
  SingleSchema,
} from './../../../shared/entities';
import { Logger } from './../../shared/providers/logger';
import { Inspector } from './inspector';
import { SchemaCheckWarning } from './models/shared';
import { extendWithBase, isCompositeSchema, SchemaHelper } from './schema-helper';

// The reason why I'm using `result` and `reason` instead of just `data` for both:
// https://bit.ly/hive-check-result-data
export type CheckResult<C = unknown, F = unknown> =
  | {
      status: 'completed';
      result: C;
    }
  | {
      status: 'failed';
      reason: F;
    }
  | {
      status: 'skipped';
    };

type Schemas = [SingleSchema] | PushedCompositeSchema[];

type CompositionValidationError = {
  message: string;
  source: 'composition';
};

type CompositionGraphQLValidationError = {
  message: string;
  source: 'graphql';
};

function isCompositionValidationError(
  error: CompositionFailureError,
): error is CompositionValidationError {
  return error.source === 'composition';
}

function isGraphQLValidationError(
  error: CompositionFailureError,
): error is CompositionGraphQLValidationError {
  return !isCompositionValidationError(error);
}

function mapContract(contract: Exclude<ComposeAndValidateResult['contracts'], null>[number]) {
  if (Array.isArray(contract.errors) && contract.errors.length) {
    return {
      status: 'failed',
      reason: {
        errors: contract.errors,
        errorsBySource: {
          graphql: contract.errors.filter(isGraphQLValidationError),
          composition: contract.errors.filter(isCompositionValidationError),
        },
        // Federation 1 apparently has SDL and validation errors at the same time.
        fullSchemaSdl: contract.sdl,
      },
    } satisfies ContractCompositionFailure;
  }

  if (!contract.sdl) {
    throw new Error('No SDL, but no errors either');
  }

  return {
    status: 'completed',
    result: {
      fullSchemaSdl: contract.sdl,
      supergraph: contract.supergraph,
    },
  } satisfies ContractCompositionSuccess;
}

type ContractCompositionFailure = {
  status: 'failed';
  reason: {
    errors: CompositionFailureError[];
    errorsBySource: {
      graphql: CompositionGraphQLValidationError[];
      composition: CompositionValidationError[];
    };
    // Federation 1 apparently has SDL and validation errors at the same time.
    fullSchemaSdl: string | null;
  };
  result?: never;
};

export type ContractCompositionSuccess = {
  status: 'completed';
  result: {
    fullSchemaSdl: string;
    supergraph: string | null;
  };
  reason?: never;
};

export type ContractCompositionResult = ContractCompositionFailure | ContractCompositionSuccess;

type SchemaDiffFailure = {
  status: 'failed';
  reason: {
    breaking: Array<SchemaChangeType> | null;
    safe: Array<SchemaChangeType> | null;
    all: Array<SchemaChangeType> | null;
  };
  result?: never;
};

export type SchemaDiffSuccess = {
  status: 'completed';
  result: {
    breaking: Array<SchemaChangeType> | null;
    safe: Array<SchemaChangeType> | null;
    all: Array<SchemaChangeType> | null;
  };
  reason?: never;
};

export type SchemaDiffSkip = {
  status: 'skipped';
  result?: never;
  reason?: never;
};

export type SchemaDiffResult = SchemaDiffFailure | SchemaDiffSuccess | SchemaDiffSkip;

@Injectable({
  scope: Scope.Operation,
})
export class RegistryChecks {
  constructor(
    private helper: SchemaHelper,
    private policy: SchemaPolicyProvider,
    private inspector: Inspector,
    private logger: Logger,
    private operationsReader: OperationsReader,
    private storage: Storage,
  ) {}

  async checksum(args: {
    incoming: {
      schemas: Schemas;
      contractNames: null | Array<string>;
    };
    existing: null | {
      schemas: Schemas;
      contractNames: null | Array<string>;
    };
  }) {
    this.logger.debug(
      'Checksum check (existingSchemaCount=%s, existingContractCount=%s, incomingSchemaCount=%s, existingContractCount=%s)',
      args.existing?.schemas.length ?? null,
      args.existing?.contractNames?.length ?? null,
      args.incoming.schemas.length,
      args.incoming.contractNames?.length ?? null,
    );

    if (!args.existing) {
      this.logger.debug('No exiting version');
      return 'initial' as const;
    }

    const isSchemasModified =
      this.helper.createChecksumFromSchemas(args.existing.schemas) !==
      this.helper.createChecksumFromSchemas(args.incoming.schemas);

    if (isSchemasModified) {
      this.logger.debug('Schema is modified.');
      return 'modified' as const;
    }

    const existingContractNames = args.existing.contractNames;
    const incomingContractNames = args.incoming.contractNames;

    if (existingContractNames === null && incomingContractNames === null) {
      this.logger.debug('No contracts.');
      return 'unchanged' as const;
    }

    if (
      existingContractNames?.length &&
      incomingContractNames?.length &&
      existingContractNames.length === incomingContractNames.length
    ) {
      const sortedExistingContractNames = existingContractNames.slice().sort(compareAlphaNumeric);
      const sortedIncomingContractNames = incomingContractNames.slice().sort(compareAlphaNumeric);

      if (
        sortedExistingContractNames.every(
          (name, index) => name === sortedIncomingContractNames[index],
        )
      ) {
        this.logger.debug('Contracts have not changed.');
        return 'unchanged' as const;
      }
    }

    this.logger.debug('Contracts have changed.');

    return 'modified' as const;
  }

  async composition({
    orchestrator,
    project,
    organization,
    schemas,
    baseSchema,
    contracts,
  }: {
    orchestrator: Orchestrator;
    project: Project;
    organization: Organization;
    schemas: Schemas;
    baseSchema: string | null;
    contracts: null | ContractsInputType;
  }) {
    const result = await orchestrator.composeAndValidate(
      extendWithBase(schemas, baseSchema).map(s => this.helper.createSchemaObject(s)),
      {
        external: project.externalComposition,
        native: this.checkProjectNativeFederationSupport(project, organization),
        contracts,
      },
    );

    const validationErrors = result.errors;

    if (Array.isArray(validationErrors) && validationErrors.length) {
      this.logger.debug('Detected validation errors');

      return {
        status: 'failed',
        reason: {
          errors: validationErrors,
          errorsBySource: {
            graphql: validationErrors.filter(isGraphQLValidationError),
            composition: validationErrors.filter(isCompositionValidationError),
          },
          // Federation 1 apparently has SDL and validation errors at the same time.
          fullSchemaSdl: result.sdl,
          contracts: result.contracts?.map(mapContract) ?? null,
        },
      } satisfies CheckResult;
    }

    this.logger.debug('No validation errors');

    if (!result.sdl) {
      throw new Error('No SDL, but no errors either');
    }

    return {
      status: 'completed',
      result: {
        fullSchemaSdl: result.sdl,
        supergraph: result.supergraph,
        tags: result.tags ?? null,
        contracts: result.contracts?.map(mapContract) ?? null,
      },
    } satisfies CheckResult;
  }

  /**
   * Retrieve the SDL of the previous schema version.
   * Either by using pre-computed sdl or composing on the fly.
   */
  async retrievePreviousVersionSdl(args: {
    version: {
      isComposable: boolean;
      sdl: string | null;
      schemas: Schemas;
    } | null;
    orchestrator: Orchestrator;
    organization: Organization;
    project: Project;
  }): Promise<string | null> {
    this.logger.debug('Retrieve previous version SDL.');
    if (!args.version) {
      this.logger.debug('No previous version available, skip.');
      return null;
    }

    if (args.version.sdl) {
      this.logger.debug('Return pre-computed SDL.');
      return args.version.sdl;
    }

    if (args.version.isComposable === false) {
      this.logger.debug('Skip composition due to non-composable version.');
      return null;
    }

    this.logger.debug('Compose on the fly.');

    const existingSchemaResult = await args.orchestrator.composeAndValidate(
      args.version.schemas.map(s => this.helper.createSchemaObject(s)),
      {
        external: args.project.externalComposition,
        native: this.checkProjectNativeFederationSupport(args.project, args.organization),
        contracts: null,
      },
    );

    return existingSchemaResult.sdl ?? null;
  }

  async policyCheck({
    selector,
    modifiedSdl,
    incomingSdl,
  }: {
    modifiedSdl: string;
    incomingSdl: string | null;
    selector: {
      organization: string;
      project: string;
      target: string;
    };
  }) {
    if (incomingSdl == null) {
      this.logger.debug('Skip policy check due to no SDL being composed.');
      return {
        status: 'skipped',
      };
    }

    const policyResult = await this.policy.checkPolicy(incomingSdl, modifiedSdl, selector);
    const warnings = policyResult?.warnings?.map<SchemaCheckWarning>(toSchemaCheckWarning) ?? null;

    if (policyResult === null) {
      return {
        status: 'skipped',
      } satisfies CheckResult;
    }

    if (policyResult.success) {
      return {
        status: 'completed',
        result: {
          warnings,
        },
      } satisfies CheckResult;
    }

    return {
      status: 'failed',
      reason: {
        errors: policyResult.errors.map(toSchemaCheckWarning),
        warnings,
      },
    } satisfies CheckResult;
  }

  private async getConditionalBreakingChangeSettings({
    selector,
  }: {
    selector: {
      organization: string;
      project: string;
      target: string;
    };
  }) {
    try {
      const settings = await this.storage.getTargetSettings(selector);

      if (!settings.validation.enabled) {
        this.logger.debug('Usage validation disabled');
        this.logger.debug('Mark all as used');
        return null;
      }

      if (settings.validation.enabled && settings.validation.targets.length === 0) {
        this.logger.debug('Usage validation enabled but no targets to check against');
        this.logger.debug('Mark all as used');
        return null;
      }

      return {
        period: settings.validation.period,
        percentage: settings.validation.percentage,
        targets: settings.validation.targets,
        excludedClients: settings.validation.excludedClients?.length
          ? settings.validation.excludedClients
          : null,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get settings`, error);
      return null;
    }
  }

  /**
   * Diff incoming and existing SDL and generate a list of changes.
   * Uses usage stats to determine whether a change is safe or not (if available).
   */
  async diff(args: {
    /** The existing SDL */
    existingSdl: string | null;
    /** The incoming SDL */
    incomingSdl: string | null;
    includeUrlChanges:
      | false
      | {
          schemasBefore: [SingleSchema] | PushedCompositeSchema[];
          schemasAfter: [SingleSchema] | PushedCompositeSchema[];
        };
    /** Whether Federation directive related changes should be filtered out from the list of changes. These would only show up due to an internal bug. */
    filterOutFederationChanges: boolean;
    /** Lookup map of changes that are approved and thus safe. */
    approvedChanges: null | Map<string, SchemaChangeType>;
    /** Selector for fetching conditional breaking changes. */
    usageDataSelector: null | {
      organization: string;
      project: string;
      target: string;
    };
  }) {
    if (args.existingSdl == null || args.incomingSdl == null) {
      this.logger.debug('Skip diff check due to either existing or incoming SDL being absent.');
      return {
        status: 'skipped',
      } satisfies CheckResult;
    }

    let existingSchema: GraphQLSchema;
    let incomingSchema: GraphQLSchema;

    try {
      existingSchema = buildSortedSchemaFromSchemaObject(
        this.helper.createSchemaObject({
          sdl: args.existingSdl,
        }),
      );

      incomingSchema = buildSortedSchemaFromSchemaObject(
        this.helper.createSchemaObject({
          sdl: args.incomingSdl,
        }),
      );
    } catch (error) {
      this.logger.error('Failed to build schema for diff. Skip diff check.');
      return {
        status: 'skipped',
      } satisfies CheckResult;
    }

    const settings = args.usageDataSelector
      ? await this.getConditionalBreakingChangeSettings({
          selector: args.usageDataSelector,
        })
      : null;

    let inspectorChanges = await this.inspector.diff(existingSchema, incomingSchema);

    // Filter out federation specific changes as they are not relevant for the schema diff and were in previous schema versions by accident.
    if (args.filterOutFederationChanges === true) {
      inspectorChanges = inspectorChanges.filter(change => !isFederationRelatedChange(change));
    }

    if (settings) {
      this.logger.debug('Conditional breaking change settings available.');
      const period = createPeriod(`${settings.period}d`);
      const totalAmountOfRequests = await this.operationsReader.getTotalAmountOfRequests({
        targetIds: settings.targets,
        excludedClients: settings.excludedClients,
        period,
      });
      this.logger.debug('Fetching affected operations and affected clients for breaking changes.');

      await Promise.all(
        inspectorChanges.map(async change => {
          if (change.criticality !== CriticalityLevel.Breaking || !change.path) {
            return;
          }

          // We need to run both the affected operations an affected clients query.
          // Since the affected clients query is lighter it makes more sense to run it first and skip running the operations query if no clients are affected, as it will also yield zero results in that case.

          const affectedClients = await this.operationsReader.getTopClientsForSchemaCoordinate({
            targetIds: settings.targets,
            excludedClients: settings.excludedClients,
            period,
            schemaCoordinate: change.path,
          });

          if (affectedClients) {
            const affectedOperations =
              await this.operationsReader.getTopOperationsForSchemaCoordinate({
                targetIds: settings.targets,
                excludedClients: settings.excludedClients,
                period,
                schemaCoordinate: change.path,
              });

            if (affectedOperations) {
              change.usageStatistics = {
                topAffectedOperations: affectedOperations.map(record => ({
                  ...record,
                  percentage: (record.count / totalAmountOfRequests) * 100,
                })),
                topAffectedClients: affectedClients.map(record => ({
                  ...record,
                  percentage: (record.count / totalAmountOfRequests) * 100,
                })),
              };
            }
          }

          if (!change.usageStatistics) {
            change.isSafeBasedOnUsage = true;
          }
        }),
      );
    } else {
      this.logger.debug('No conditional breaking change settings available');
    }

    if (args.includeUrlChanges) {
      inspectorChanges.push(
        ...detectUrlChanges(
          args.includeUrlChanges.schemasBefore.filter(isCompositeSchema),
          args.includeUrlChanges.schemasAfter.filter(isCompositeSchema),
        ),
      );
    }

    let isFailure = false;
    const safeChanges: Array<SchemaChangeType> = [];
    const breakingChanges: Array<SchemaChangeType> = [];

    for (const change of inspectorChanges) {
      if (change.criticality === CriticalityLevel.Breaking) {
        if (change.isSafeBasedOnUsage === true) {
          breakingChanges.push(change);
          continue;
        }

        // If this change is approved, we return the already approved on instead of the newly detected one,
        // as it it contains the necessary metadata on when the change got first approved and by whom.
        const approvedChange = args.approvedChanges?.get(change.id);
        if (approvedChange) {
          breakingChanges.push({
            ...approvedChange,
            isSafeBasedOnUsage: change.isSafeBasedOnUsage,
            usageStatistics: change.usageStatistics,
          });
          continue;
        }
        isFailure = true;
        breakingChanges.push(change);
        continue;
      }
      safeChanges.push(change);
    }

    if (isFailure === true) {
      this.logger.debug('Detected breaking changes');
      return {
        status: 'failed',
        reason: {
          breaking: breakingChanges,
          safe: safeChanges.length ? safeChanges : null,
          get all() {
            if (breakingChanges.length || safeChanges.length) {
              return [...breakingChanges, ...safeChanges];
            }
            return null;
          },
        },
      } satisfies SchemaDiffFailure;
    }

    if (inspectorChanges.length) {
      this.logger.debug('Detected non-breaking changes');
    }

    return {
      status: 'completed',
      result: {
        breaking: breakingChanges.length ? breakingChanges : null,
        safe: safeChanges.length ? safeChanges : null,
        get all() {
          if (breakingChanges.length || safeChanges.length) {
            return [...breakingChanges, ...safeChanges];
          }
          return null;
        },
      },
    } satisfies SchemaDiffSuccess;
  }

  async serviceName(service: { name: string | null }) {
    if (!service.name) {
      this.logger.debug('No service name');
      return {
        status: 'failed',
        reason: 'Service name is required',
      } satisfies CheckResult;
    }

    this.logger.debug('Service name is defined');

    return {
      status: 'completed',
      result: null,
    } satisfies CheckResult;
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);

      return true;
    } catch {
      return false;
    }
  }

  async serviceUrl(
    service: { url: string | null },
    existingService: { url: string | null } | null,
  ) {
    if (!service.url) {
      this.logger.debug('No service url');
      return {
        status: 'failed',
        reason: 'Service url is required',
      } satisfies CheckResult;
    }

    this.logger.debug('Service url is defined');

    if (!this.isValidURL(service.url)) {
      return {
        status: 'failed',
        reason: 'Invalid service URL provided',
      } satisfies CheckResult;
    }

    return {
      status: 'completed',
      result:
        existingService && service.url !== existingService.url
          ? {
              before: existingService.url,
              after: service.url,
              message: service.url
                ? `New service url: ${service.url} (previously: ${existingService.url ?? 'none'})`
                : `Service url removed (previously: ${existingService.url ?? 'none'})`,
              status: 'modified' as const,
            }
          : {
              status: 'unchanged' as const,
            },
    } satisfies CheckResult;
  }

  async metadata(
    service: {
      metadata?: string | null;
    },
    existingService: { metadata?: string | null } | null,
  ) {
    try {
      const parsed = service.metadata
        ? (JSON.parse(service.metadata) as Record<string, unknown>)
        : null;

      const modified =
        existingService &&
        hashObject(parsed) !==
          hashObject(existingService.metadata ? JSON.parse(existingService.metadata) : null);

      if (modified) {
        this.logger.debug('Metadata is modified');
      } else {
        this.logger.debug('Metadata is unchanged');
      }

      return {
        status: 'completed',
        result: {
          status: modified ? ('modified' as const) : ('unchanged' as const),
        },
      } satisfies CheckResult;
    } catch (e) {
      this.logger.debug('Failed to parse metadata');
      return {
        status: 'failed',
        reason: String(e instanceof Error ? e.message : e),
      } satisfies CheckResult;
    }
  }

  public checkProjectNativeFederationSupport(
    project: Project,
    organization: Organization,
  ): boolean {
    if (project.type !== ProjectType.FEDERATION) {
      return false;
    }

    if (project.nativeFederation === false) {
      return false;
    }

    if (project.legacyRegistryModel === true) {
      this.logger.warn(
        'Project is using legacy registry model, ignoring native Federation support (organization=%s, project=%s)',
        organization.id,
        project.id,
      );
      return false;
    }

    if (organization.featureFlags.compareToPreviousComposableVersion === false) {
      this.logger.warn(
        'Organization has compareToPreviousComposableVersion FF disabled, ignoring native Federation support (organization=%s, project=%s)',
        organization.id,
        project.id,
      );
      return false;
    }

    this.logger.debug(
      'Native Federation support available (organization=%s, project=%s)',
      organization.id,
      project.id,
    );
    return true;
  }
}

type SubgraphDefinition = {
  service_name: string;
  service_url: string | null;
};

export function detectUrlChanges(
  subgraphsBefore: readonly SubgraphDefinition[],
  subgraphsAfter: readonly SubgraphDefinition[],
): Array<SchemaChangeType> {
  if (subgraphsBefore.length === 0) {
    return [];
  }

  if (subgraphsBefore.length === 0) {
    return [];
  }

  const nameToCompositeSchemaMap = new Map(subgraphsBefore.map(s => [s.service_name, s]));
  const changes: Array<RegistryServiceUrlChangeSerializableChange> = [];

  for (const schema of subgraphsAfter) {
    const before = nameToCompositeSchemaMap.get(schema.service_name);

    if (before && before.service_url !== schema.service_url) {
      if (before.service_url && schema.service_url) {
        changes.push({
          type: 'REGISTRY_SERVICE_URL_CHANGED',
          meta: {
            serviceName: schema.service_name,
            serviceUrls: {
              old: before.service_url,
              new: schema.service_url,
            },
          },
        });
      } else if (before.service_url && schema.service_url == null) {
        changes.push({
          type: 'REGISTRY_SERVICE_URL_CHANGED',
          meta: {
            serviceName: schema.service_name,
            serviceUrls: {
              old: before.service_url,
              new: null,
            },
          },
        });
      } else if (before.service_url == null && schema.service_url) {
        changes.push({
          type: 'REGISTRY_SERVICE_URL_CHANGED',
          meta: {
            serviceName: schema.service_name,
            serviceUrls: {
              old: null,
              new: schema.service_url,
            },
          },
        });
      } else {
        throw new Error("This shouldn't happen.");
      }
    }
  }

  return changes.map(change =>
    HiveSchemaChangeModel.parse({
      type: change.type,
      meta: change.meta,
      isSafeBasedOnUsage: false,
    }),
  );
}

const toSchemaCheckWarning = (record: CheckPolicyResponse[number]): SchemaCheckWarning => ({
  message: record.message,
  source: record.ruleId ? `policy-${record.ruleId}` : 'policy',
  column: record.column,
  line: record.line,
  ruleId: record.ruleId ?? 'policy',
  endColumn: record.endColumn ?? null,
  endLine: record.endLine ?? null,
});

const federationTypes = new Set(['join__FieldSet', 'join__Graph', 'link__Import', 'link__Purpose']);
const federationDirectives = new Set([
  '@join__enumValue',
  '@join__field',
  '@join__graph',
  '@join__implements',
  '@join__type',
  '@join__unionMember',
  '@link',
  '@federation__inaccessible',
  '@inaccessible',
  '@tag',
  '@federation__tag',
]);

function isFederationRelatedChange(change: SchemaChangeType) {
  return change.path && (federationTypes.has(change.path) || federationDirectives.has(change.path));
}

function compareAlphaNumeric(a: string, b: string) {
  return a.localeCompare(b, 'en', { numeric: true });
}
