import { InjectionToken } from 'graphql-modules';

export interface SchemaPolicyServiceConfig {
  endpoint: string | null;
}

export const SCHEMA_POLICY_SERVICE_CONFIG = new InjectionToken<SchemaPolicyServiceConfig>(
  'schema-policy-service-config',
);
