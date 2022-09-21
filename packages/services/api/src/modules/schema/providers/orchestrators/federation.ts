import { Injectable, Inject, Scope, CONTEXT } from 'graphql-modules';
import { parse } from 'graphql';
import { Logger } from '../../../shared/providers/logger';
import { sentry } from '../../../../shared/sentry';
import { Orchestrator, ProjectType, SchemaObject } from '../../../../shared/entities';
import { SchemaBuildError } from './errors';
import { SCHEMA_SERVICE_CONFIG } from './tokens';
import type { SchemaServiceConfig } from './tokens';
import { createTRPCClient } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import type { SchemaBuilderApi } from '@hive/schema';

type ExternalComposition = {
  enabled: boolean;
  endpoint: string;
  encryptedSecret: string;
} | null;

@Injectable({
  scope: Scope.Operation,
})
export class FederationOrchestrator implements Orchestrator {
  type = ProjectType.FEDERATION;
  private logger: Logger;
  private schemaService;

  constructor(
    logger: Logger,
    @Inject(SCHEMA_SERVICE_CONFIG) serviceConfig: SchemaServiceConfig,
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext
  ) {
    this.logger = logger.child({ service: 'FederationOrchestrator' });
    this.schemaService = createTRPCClient<SchemaBuilderApi>({
      url: `${serviceConfig.endpoint}/trpc`,
      fetch,
      headers: {
        'x-request-id': context.requestId,
      },
    });
  }

  ensureConfig(config?: ExternalComposition) {
    if (config && config.enabled) {
      if (!config.endpoint) {
        throw new Error('External composition error: endpoint is missing');
      }

      if (!config.encryptedSecret) {
        throw new Error('External composition error: encryptedSecret is missing');
      }
    }
  }

  @sentry('FederationOrchestrator.validate')
  async validate(schemas: SchemaObject[], external: ExternalComposition) {
    this.logger.debug('Validating Federated Schemas');

    const result = await this.schemaService.mutation('validate', {
      type: 'federation',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
      })),
      external: external?.enabled ? external : null,
    });

    return result.errors;
  }

  @sentry('FederationOrchestrator.build')
  async build(schemas: SchemaObject[], external: ExternalComposition): Promise<SchemaObject> {
    this.logger.debug('Building Federated Schemas');

    try {
      const result = await this.schemaService.mutation('build', {
        type: 'federation',
        schemas: schemas.map(s => ({
          raw: s.raw,
          source: s.source,
        })),
        external: external?.enabled ? external : null,
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
  async supergraph(schemas: SchemaObject[], external: ExternalComposition): Promise<string | null> {
    this.logger.debug('Generating Federated Supergraph');

    const result = await this.schemaService.mutation('supergraph', {
      type: 'federation',
      schemas: schemas.map(s => ({
        raw: s.raw,
        source: s.source,
        url: s.url,
      })),
      external: external?.enabled ? external : null,
    });

    return result.supergraph;
  }
}
