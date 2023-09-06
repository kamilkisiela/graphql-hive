import { InjectionToken, Provider, Scope } from 'graphql-modules';

export interface SupportConfig {
  username: string;
  password: string;
  subdomain: string;
}

export const SUPPORT_MODULE_CONFIG = new InjectionToken<SupportConfig>('SupportConfig');

export function provideSupportConfig(config: SupportConfig): Provider {
  return {
    provide: SUPPORT_MODULE_CONFIG,
    useValue: config,
    scope: Scope.Singleton,
  };
}
