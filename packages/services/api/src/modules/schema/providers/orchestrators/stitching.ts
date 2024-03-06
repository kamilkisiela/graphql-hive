import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import type { SchemaBuilderApi } from '@hive/schema';
import { createTimeoutHTTPLink } from '@hive/service-common';
import { createTRPCProxyClient } from '@trpc/client';
import { Orchestrator, ProjectType, SchemaObject } from '../../../../shared/entities';
import { sentry } from '../../../../shared/sentry';
import { Logger } from '../../../shared/providers/logger';
import type { SchemaServiceConfig } from './tokens';
import { SCHEMA_SERVICE_CONFIG } from './tokens';

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
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext,
  ) {
    this.logger = logger.child({ service: 'StitchingOrchestrator' });
    this.schemaService = createTRPCProxyClient<SchemaBuilderApi>({
      links: [
        createTimeoutHTTPLink({
          url: `${serviceConfig.endpoint}/trpc`,
          fetch,
          headers: {
            'x-request-id': context.requestId,
          },
        }),
      ],
    });
  }

  @sentry('StitchingOrchestrator.composeAndValidate')
  async composeAndValidate(schemas: SchemaObject[]) {
    this.logger.debug('Composing and Validating Stitched Schemas');

    const result = await this.schemaService.composeAndValidate.mutate({
      type: 'stitching',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
        url: s.url ?? null,
      })),
    });

    return result;
  }
}
