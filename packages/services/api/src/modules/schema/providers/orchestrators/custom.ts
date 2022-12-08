import { parse } from 'graphql';
import { Injectable } from 'graphql-modules';
import type { SchemaError } from '../../../../__generated__/types';
import { emptySource, Orchestrator, ProjectType, SchemaObject } from '../../../../shared/entities';
import { HiveError } from '../../../../shared/errors';
import { sentry } from '../../../../shared/sentry';
import { HttpClient } from '../../../shared/providers/http-client';
import { Logger } from '../../../shared/providers/logger';
import { SchemaBuildError } from './errors';

export interface CustomOrchestratorConfig {
  validationUrl: string;
  buildUrl: string;
}

type BuildResponse = BuildFailureResponse | BuildSuccessResponse;

interface BuildFailureResponse {
  errors: SchemaError[];
}

interface BuildSuccessResponse {
  schema: string;
}

@Injectable()
export class CustomOrchestrator implements Orchestrator {
  type = ProjectType.CUSTOM;
  private logger: Logger;

  constructor(logger: Logger, private http: HttpClient) {
    this.logger = logger.child({ service: 'CustomOrchestrator' });
  }

  ensureConfig(config: CustomOrchestratorConfig) {
    if (!config) {
      throw new HiveError('Config is missing');
    }

    if (!config.buildUrl) {
      throw new HiveError('Build endpoint is missing');
    }

    if (!config.validationUrl) {
      throw new HiveError('Validation endpoint is missing');
    }
  }

  @sentry('CustomOrchestrator.validate')
  async validate(
    schemas: SchemaObject[],
    config: CustomOrchestratorConfig,
  ): Promise<SchemaError[]> {
    this.logger.debug('Validating Custom Schemas');
    return this.http.post(config.validationUrl, {
      responseType: 'json',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
      },
      json: {
        schemas: schemas.map(s => s.raw),
      },
    });
  }

  @sentry('CustomOrchestrator.build')
  async build(schemas: SchemaObject[], config: CustomOrchestratorConfig): Promise<SchemaObject> {
    this.logger.debug('Building Custom Schema');
    try {
      const response = await this.http.post<BuildResponse>(config.buildUrl, {
        responseType: 'json',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Content-Type': 'application/json',
        },
        json: {
          schemas: schemas.map(s => s.raw),
        },
      });

      if (hasErrors(response)) {
        throw new HiveError(
          [`Schema couldn't be build:`, response.errors.map(error => `\t - ${error.message}`)].join(
            '\n',
          ),
        );
      }

      const raw = response.schema;

      return {
        raw,
        document: parse(raw),
        source: emptySource,
      };
    } catch (error: any) {
      throw new SchemaBuildError(error);
    }
  }

  async supergraph() {
    return null;
  }
}

function hasErrors(response: any): response is BuildFailureResponse {
  return response.errors;
}
