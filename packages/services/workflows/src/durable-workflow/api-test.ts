import { z } from 'zod';
import { defineTask, defineWorkflow, implementWorkflow } from './kit';

async function loadArtifact(userId: string) {
  return { userId };
}

const fetchUser = defineTask({
  name: 'fetch-user',
  version: 1,
  output: z.strictObject({
    id: z.string().uuid(),
    email: z.string().email(),
  }),
});

const fetchOrders = defineTask({
  name: 'fetch-orders',
  version: 1,
  output: z.array(
    z.strictObject({
      id: z.string().uuid(),
      total: z.number(),
    }),
  ),
});

const SyncUserWorkflow = defineWorkflow({
  name: 'sync-user',
  version: 1,

  input: z.strictObject({
    userId: z.string().uuid(),
  }),

  output: z.strictObject({
    userId: z.string().uuid(),
    orderCount: z.number().int().nonnegative(),
  }),
});

export const workflow = implementWorkflow(
  SyncUserWorkflow,
  async function* ({ context: ctx, input }) {
    // Regular awaits are executed again on every workflow replay.
    const artifact = await loadArtifact(input.userId);

    const { user, orders } = yield* ctx.all({
      user: ctx.task(fetchUser, {
        id: 'fetch-user',
        run: async () => ({
          id: artifact.userId,
          email: 'user@example.com',
        }),
      }),
      orders: ctx.task(fetchOrders, {
        id: 'fetch-orders',
        run: async () => [],
      }),
    });

    yield* ctx.task(fetchUser, {
      id: 'fetch-user-1',
      run: async () => ({
        id: input.userId,
        email: 'other-user@example.com',
      }),
    });

    return {
      userId: user.id,
      orderCount: orders.length,
    };
  },
);
