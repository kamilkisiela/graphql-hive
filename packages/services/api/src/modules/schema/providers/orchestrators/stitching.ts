import { Injectable, Inject, Scope, CONTEXT } from 'graphql-modules';
import { parse } from 'graphql';
import { Logger } from '../../../shared/providers/logger';
import { Orchestrator, ProjectType, SchemaObject } from '../../../../shared/entities';
import { SchemaBuildError } from './errors';
import { SCHEMA_SERVICE_CONFIG } from './tokens';
import type { SchemaServiceConfig } from './tokens';
import { sentry } from '../../../../shared/sentry';
import { createTRPCClient } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import type { SchemaBuilderApi } from '@hive/schema';

@Injectable({
  scope: Scope.Operation,
})
export class StitchingOrchestrator implements Orchestrator {
  type = ProjectType.STITCHING;
  private logger: Logger;
  private schemaService;

  constructor(
    logger: Logger,
    @Inject(SCHEMA_SERVICE_CONFIG) serviceConfig: SchemaServiceConfig,
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext
  ) {
    this.logger = logger.child({ service: 'StitchingOrchestrator' });
    this.schemaService = createTRPCClient<SchemaBuilderApi>({
      url: `${serviceConfig.endpoint}/trpc`,
      fetch,
      headers: {
        'x-request-id': context.requestId,
      },
    });
  }

  ensureConfig() {}

  @sentry('StitchingOrchestrator.validate')
  async validate(schemas: SchemaObject[]) {
    this.logger.debug('Validating Stitched Schemas');

    const result = await this.schemaService.mutation('validate', {
      type: 'stitching',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
      })),
      external: null,
    });

    return result.errors;
  }

  @sentry('StitchingOrchestrator.build')
  async build(schemas: SchemaObject[]): Promise<SchemaObject> {
    this.logger.debug('Building Stitched Schemas');
    try {
      const result = await this.schemaService.mutation('build', {
        type: 'stitching',
        schemas: schemas.map(s => ({
          raw: s.raw,
          source: s.source,
        })),
        external: null,
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

  async supergraph() {
    return null;
  }
}
