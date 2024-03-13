import { Inject, Injectable, Scope } from 'graphql-modules';
import type { AvailableRulesResponse, SchemaPolicyApi, SchemaPolicyApiInput } from '@hive/policy';
import { traceFn } from '@hive/service-common';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { Logger } from '../../shared/providers/logger';
import type { SchemaPolicyServiceConfig } from './tokens';
import { SCHEMA_POLICY_SERVICE_CONFIG } from './tokens';

@Injectable({
  global: true,
  scope: Scope.Singleton,
})
export class SchemaPolicyApiProvider {
  private logger: Logger;
  private schemaPolicy;
  private cachedAvailableRules: AvailableRulesResponse | null = null;

  constructor(
    rootLogger: Logger,
    @Inject(SCHEMA_POLICY_SERVICE_CONFIG)
    config: SchemaPolicyServiceConfig,
  ) {
    this.logger = rootLogger.child({ service: 'SchemaPolicyApiProvider' });
    this.schemaPolicy = config.endpoint
      ? createTRPCProxyClient<SchemaPolicyApi>({
          links: [
            httpLink({
              url: `${config.endpoint}/trpc`,
              fetch,
            }),
          ],
        })
      : null;
  }

  @traceFn('SchemaPolicyProvider.checkPolicy', {
    resultAttributes: result => ({
      'hive.policy.result.count': result.length,
    }),
  })
  checkPolicy(input: SchemaPolicyApiInput['checkPolicy']) {
    if (this.schemaPolicy === null) {
      this.logger.warn(
        `Unable to check schema-policy for input: %o , service information is not available`,
        input,
      );

      return [];
    }

    this.logger.debug(`Checking schema policy for target id="${input.target}"`);

    return this.schemaPolicy.checkPolicy.mutate(input);
  }

  async validateConfig(input: SchemaPolicyApiInput['validateConfig']) {
    if (this.schemaPolicy === null) {
      this.logger.warn(
        `Unable to validate schema-policy for input: %o , service information is not available`,
        input,
      );

      return false;
    }

    this.logger.debug(`Checking schema policy config validity`);

    return await this.schemaPolicy.validateConfig.query(input);
  }

  async listAvailableRules() {
    if (this.schemaPolicy === null) {
      this.logger.warn(
        `Unable to check schema-policy for input: %o , service information is not available`,
      );

      return [];
    }

    if (this.cachedAvailableRules === null) {
      this.logger.debug(`Fetching schema policy available rules`);
      this.cachedAvailableRules = await this.schemaPolicy.availableRules.query();
    }

    return this.cachedAvailableRules;
  }
}
