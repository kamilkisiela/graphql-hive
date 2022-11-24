import { InjectionToken } from 'graphql-modules';

export interface SchemaServiceConfig {
  endpoint: string;
}

export const SCHEMA_SERVICE_CONFIG = new InjectionToken<SchemaServiceConfig>(
  'schema-service-config',
);
