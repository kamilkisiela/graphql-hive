import { InjectionToken, Provider, Scope } from 'graphql-modules';

export interface SchemaModuleConfig {
  schemaPublishLink?(input: {
    organization: {
      cleanId: string;
    };
    project: {
      cleanId: string;
    };
    target: {
      cleanId: string;
    };
    version?: {
      id: string;
    };
  }): string;
  schemaCheckLink?(input: {
    organization: {
      cleanId: string;
    };
    project: {
      cleanId: string;
    };
    target: {
      cleanId: string;
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
