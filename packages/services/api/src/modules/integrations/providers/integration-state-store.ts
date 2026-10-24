import { Inject, Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import { EphemeralStateStore } from '../../shared/providers/ephemeral-state-store';
import { REDIS_INSTANCE, type Redis } from '../../shared/providers/redis';

const IntegrationStateModel = z.discriminatedUnion('method', [
  z.object({ method: z.literal('github'), organizationId: z.string().uuid(), userId: z.string() }),
  z.object({ method: z.literal('slack'), organizationId: z.string().uuid(), userId: z.string() }),
]);

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class IntegrationStateStore extends EphemeralStateStore<typeof IntegrationStateModel> {
  protected readonly model = IntegrationStateModel;
  protected readonly keyPrefix = 'integration-state';

  constructor(@Inject(REDIS_INSTANCE) redis: Redis) {
    super(redis);
  }
}
