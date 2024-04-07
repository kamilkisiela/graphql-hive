import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import type { SchemaBuilderApi } from '@hive/schema';
import { traceFn } from '@hive/service-common';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { Orchestrator, ProjectType, SchemaObject } from '../../../../shared/entities';
import { Logger } from '../../../shared/providers/logger';
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

  @traceFn('SingleOrchestrator.composeAndValidate', {
    initAttributes: schemas => ({
      'hive.composition.schema.count': schemas.length,
    }),
    resultAttributes: result => ({
      'hive.composition.error.count': result.errors.length,
      'hive.composition.tags.count': result.tags?.length ?? 0,
      'hive.composition.contracts.count': result.contracts?.length ?? 0,
    }),
  })
  async composeAndValidate(schemas: SchemaObject[]) {
    this.logger.debug('Composing and Validating Single Schema');

    if (schemas.length > 1) {
      this.logger.debug('More than one schema (sources=%o)', {
        sources: schemas.map(s => s.source),
      });
      throw new Error('too many schemas');
    }

    const result = await this.schemaService.composeAndValidate.mutate({
      type: 'single',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
      })),
    });

    return result;
  }
}
