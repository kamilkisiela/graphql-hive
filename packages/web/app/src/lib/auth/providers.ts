import { env } from '@/env/frontend';

type Provider = 'google' | 'okta' | 'github' | 'oidc';
const providers: Provider[] = ['google', 'okta', 'github', 'oidc'];

export const enabledProviders: Provider[] = providers.filter(provider => !!env.auth[provider]);

export function isProviderEnabled(provider: Provider) {
  return enabledProviders.includes(provider);
}
