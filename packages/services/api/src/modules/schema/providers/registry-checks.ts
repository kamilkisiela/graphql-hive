import { URL } from 'node:url';
import { Injectable, Scope } from 'graphql-modules';
import hashObject from 'object-hash';
import type { CompositionFailureError } from '@hive/schema';
import { buildSchema } from '../../../shared/schema';
import type {
  Orchestrator,
  Project,
  PushedCompositeSchema,
  SingleSchema,
} from './../../../shared/entities';
import { Logger } from './../../shared/providers/logger';
import { Inspector } from './inspector';
import { ensureSDL, extendWithBase, SchemaHelper } from './schema-helper';

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

type LatestVersion = {
  isComposable: boolean;
  schemas: Schemas;
} | null;

function isCompositionValidationError(error: CompositionFailureError): error is {
  message: string;
  source: 'composition';
} {
  return error.source === 'composition';
}

function isGraphQLValidationError(error: CompositionFailureError): error is {
  message: string;
  source: 'graphql';
} {
  return !isCompositionValidationError(error);
}

@Injectable({
  scope: Scope.Operation,
})
export class RegistryChecks {
  constructor(private helper: SchemaHelper, private inspector: Inspector, private logger: Logger) {}

  async checksum({ schemas, latestVersion }: { schemas: Schemas; latestVersion: LatestVersion }) {
    this.logger.debug(
      'Checksum check (before=%s, after=%s)',
      latestVersion?.schemas.length ?? 0,
      schemas.length,
    );
    const isInitial = latestVersion === null;

    if (isInitial || latestVersion.schemas.length === 0) {
      this.logger.debug('No exiting version');
      return {
        status: 'completed',
        result: 'initial' as const,
      } satisfies CheckResult;
    }

    const isModified =
      this.helper.createChecksumFromSchemas(schemas) !==
      this.helper.createChecksumFromSchemas(latestVersion.schemas);

    if (isModified) {
      this.logger.debug('Schema is modified');
      return {
        status: 'completed',
        result: 'modified' as const,
      } satisfies CheckResult;
    }

    this.logger.debug('Schema is unchanged');

    return {
      status: 'completed',
      result: 'unchanged' as const,
    } satisfies CheckResult;
  }

  async composition({
    orchestrator,
    project,
    schemas,
    baseSchema,
  }: {
    orchestrator: Orchestrator;
    project: Project;
    schemas: Schemas;
    baseSchema: string | null;
  }) {
    const result = await orchestrator.composeAndValidate(
      extendWithBase(schemas, baseSchema).map(s => this.helper.createSchemaObject(s)),
      project.externalComposition,
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
      },
    } satisfies CheckResult;
  }

  async diff({
    orchestrator,
    project,
    schemas,
    version,
    selector,
  }: {
    orchestrator: Orchestrator;
    project: Project;
    schemas: [SingleSchema] | PushedCompositeSchema[];
    version: LatestVersion;
    selector: {
      organization: string;
      project: string;
      target: string;
    };
  }) {
    if (!version || version.schemas.length === 0) {
      this.logger.debug('Skipping diff check, no existing version');
      return {
        status: 'skipped',
      } satisfies CheckResult;
    }

    try {
      const [existingSchema, incomingSchema] = await Promise.all([
        ensureSDL(
          orchestrator.composeAndValidate(
            version.schemas.map(s => this.helper.createSchemaObject(s)),
            project.externalComposition,
          ),
        ).then(schema => {
          return buildSchema(
            this.helper.createSchemaObject({
              sdl: schema.raw,
            }),
          );
        }),
        ensureSDL(
          orchestrator.composeAndValidate(
            schemas.map(s => this.helper.createSchemaObject(s)),
            project.externalComposition,
          ),
        ).then(schema => {
          return buildSchema(
            this.helper.createSchemaObject({
              sdl: schema.raw,
            }),
          );
        }),
      ]);

      const changes = await this.inspector.diff(existingSchema, incomingSchema, selector);
      const breakingChanges = changes
        .filter(change => change.criticality === 'Breaking')
        .map(change => ({
          message: `Breaking Change: ${change.message}`,
          path: change.path,
        }));

      const hasBreakingChanges = breakingChanges.length > 0;

      if (hasBreakingChanges) {
        this.logger.debug('Detected breaking changes');
        return {
          status: 'failed',
          reason: {
            breakingChanges,
            changes,
          },
        } satisfies CheckResult;
      }

      if (changes.length) {
        this.logger.debug('Detected non-breaking changes');
      }

      return {
        status: 'completed',
        result: {
          changes,
        },
      } satisfies CheckResult;
    } catch (error: any) {
      this.logger.debug('Failed to compare schemas (error=%s)', (error as Error).message);

      return {
        status: 'failed',
        reason: {
          breakingChanges: [
            {
              message: `Failed to compare schemas: ${(error as Error).message}`,
            },
          ],
        },
      } satisfies CheckResult;
    }
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
                : `Service url removed (previously: ${existingService.url ?? 'none'}`,
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
}
