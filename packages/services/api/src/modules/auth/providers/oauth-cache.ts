import { Inject, Injectable, Scope } from 'graphql-modules';
import z from 'zod';
import { EphemeralStateStore } from '../../shared/providers/ephemeral-state-store';
import { REDIS_INSTANCE, type Redis } from '../../shared/providers/redis';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class OAuthCache extends EphemeralStateStore<typeof OAuthRecordModel> {
  protected readonly model = OAuthRecordModel;
  protected readonly keyPrefix = 'oauth-cache';

  constructor(@Inject(REDIS_INSTANCE) redis: Redis) {
    super(redis);
  }
}

const OAuthRecordModel = z.discriminatedUnion('method', [
  z.object({ method: z.literal('github'), oidIntegrationId: z.null(), pkceVerifier: z.string() }),
  z.object({ method: z.literal('google'), oidIntegrationId: z.null(), pkceVerifier: z.string() }),
  z.object({ method: z.literal('okta'), oidIntegrationId: z.null(), pkceVerifier: z.string() }),
  z.object({ method: z.literal('oidc'), oidIntegrationId: z.string(), pkceVerifier: z.string() }),
]);
