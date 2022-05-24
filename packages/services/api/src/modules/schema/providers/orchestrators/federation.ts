import { Injectable, Inject } from 'graphql-modules';
import { parse } from 'graphql';
import { Logger } from '../../../shared/providers/logger';
import { sentry } from '../../../../shared/sentry';
import { Orchestrator, ProjectType, SchemaObject } from '../../../../shared/entities';
import { SchemaBuildError } from './errors';
import { SCHEMA_SERVICE_CONFIG } from './tokens';
import type { SchemaServiceConfig } from './tokens';
import { createTRPCClient } from '@trpc/client';
import { fetch } from 'cross-undici-fetch';
import type { SchemaBuilderApi } from '@hive/schema';

@Injectable()
export class FederationOrchestrator implements Orchestrator {
  type = ProjectType.FEDERATION;
  private logger: Logger;
  private schemaService;

  constructor(logger: Logger, @Inject(SCHEMA_SERVICE_CONFIG) private serviceConfig: SchemaServiceConfig) {
    this.logger = logger.child({ service: 'FederationOrchestrator' });
    this.schemaService = createTRPCClient<SchemaBuilderApi>({
      url: `${serviceConfig.endpoint}/trpc`,
      fetch,
    });
  }

  ensureConfig() {}

  @sentry('FederationOrchestrator.validate')
  async validate(schemas: SchemaObject[]) {
    this.logger.debug('Validating Federated Schemas');

    const result = await this.schemaService.mutation('validate', {
      type: 'federation',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
      })),
    });

    return result.errors;
  }

  @sentry('FederationOrchestrator.build')
  async build(schemas: SchemaObject[]): Promise<SchemaObject> {
    this.logger.debug('Building Federated Schemas');

    try {
      const result = await this.schemaService.mutation('build', {
        type: 'federation',
        schemas: schemas.map(s => ({
          raw: s.raw,
          source: s.source,
        })),
      });

      return {
        document: parse(result.raw),
        raw: result.raw,
        source: result.source,
      };
    } catch (error) {
      throw new SchemaBuildError(error as Error);
    }
  }

  @sentry('FederationOrchestrator.supergraph')
  async supergraph(schemas: SchemaObject[]): Promise<string | null> {
    this.logger.debug('Generating Federated Supergraph');

    const result = await this.schemaService.mutation('supergraph', {
      type: 'federation',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
        url: s.url,
      })),
    });

    return result.supergraph;
  }
}
