import { InjectionToken, Provider, Scope } from 'graphql-modules';

export interface SchemaModuleConfig {
  schemaPublishLink?(input: {
    organization: {
      slug: string;
    };
    project: {
      slug: string;
    };
    target: {
      slug: string;
    };
    version?: {
      id: string;
    };
  }): string;
  schemaCheckLink?(input: {
    organization: {
      slug: string;
    };
    project: {
      slug: string;
    };
    target: {
      slug: string;
    };
    schemaCheckId: string;
  }): string;
}

export const SCHEMA_MODULE_CONFIG = new InjectionToken<SchemaModuleConfig>('SchemaModuleConfig');

export function provideSchemaModuleConfig(config: SchemaModuleConfig): Provider {
  return {
    provide: SCHEMA_MODULE_CONFIG,
    useValue: config,
    scope: Scope.Singleton,
  };
}
