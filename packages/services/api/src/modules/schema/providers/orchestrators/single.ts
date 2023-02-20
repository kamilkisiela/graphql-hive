import { parse } from 'graphql';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import type { SchemaBuilderApi } from '@hive/schema';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import { Orchestrator, ProjectType, SchemaObject } from '../../../../shared/entities';
import { HiveError } from '../../../../shared/errors';
import { sentry } from '../../../../shared/sentry';
import { Logger } from '../../../shared/providers/logger';
import { SchemaBuildError } from './errors';
import type { SchemaServiceConfig } from './tokens';
import { SCHEMA_SERVICE_CONFIG } from './tokens';

@Injectable({
  scope: Scope.Operation,
})
export class SingleOrchestrator implements Orchestrator {
  type = ProjectType.SINGLE;
  private logger: Logger;
  private schemaService;

  constructor(
    logger: Logger,
    @Inject(SCHEMA_SERVICE_CONFIG) serviceConfig: SchemaServiceConfig,
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext,
  ) {
    this.logger = logger.child({ service: 'SingleOrchestrator' });
    this.schemaService = createTRPCProxyClient<SchemaBuilderApi>({
      links: [
        httpLink({
          url: `${serviceConfig.endpoint}/trpc`,
          fetch,
          headers: {
            'x-request-id': context.requestId,
          },
        }),
      ],
    });
  }

  @sentry('SingleOrchestrator.validate')
  async validate(schemas: SchemaObject[]) {
    this.logger.debug('Validating Single Schema');
    if (schemas.length > 1) {
      this.logger.debug('More than one schema (sources=%o)', {
        sources: schemas.map(s => s.source),
      });
      throw new HiveError('too many schemas');
    }

    const result = await this.schemaService.validate.mutate({
      type: 'single',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
      })),
      external: null,
    });

    return result.errors;
  }

  @sentry('SingleOrchestrator.build')
  async build(schemas: SchemaObject[]) {
    try {
      if (schemas.length > 1) {
        this.logger.error('More than one schema (sources=%o)', {
          sources: schemas.map(s => s.source),
        });
        throw new HiveError('too many schemas');
      }

      const result = await this.schemaService.build.mutate({
        type: 'single',
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
