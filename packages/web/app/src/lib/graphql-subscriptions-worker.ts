import { createClient } from 'graphql-sse';
import stringify from 'quick-stable-stringify';
import type {
  WorkerCompleteResponse,
  WorkerEvent,
  WorkerNextResponse,
  WorkerPing,
  WorkerSubscriptionSubscribeEvent,
} from './urql';

/**
 * Mapping of hash -> subscriptions
 * Keeps track of all active subscriptions (operation ids) per hash
 * */
const activeSubscriptions = new Map<
  string,
  {
    ids: Set<string>;
    unsubscribe: () => void;
  }
>();

/**
 * Keeps reference from operation id to hash and port
 */
const idToHashAndPortMapping = new Map<
  string,
  {
    hash: string;
    port: MessagePort;
  }
>();

const hashValue = (val: string) =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(val)).then(h => {
    let hexes = [],
      view = new DataView(h);
    for (let i = 0; i < view.byteLength; i += 4)
      hexes.push(('00000000' + view.getUint32(i).toString(16)).slice(-8));
    return hexes.join('');
  });

async function getDedupeHash(data: WorkerSubscriptionSubscribeEvent['graphql']): Promise<string> {
  return hashValue(stringify(data)!);
}

/** End an operation with a specific id. */
function endOperation(id: string) {
  const mapping = idToHashAndPortMapping.get(id);
  if (!mapping) {
    return;
  }
  const sub = activeSubscriptions.get(mapping.hash);
  if (!sub) {
    return;
  }

  idToHashAndPortMapping.delete(id);
  sub.ids.delete(id);
  if (sub.ids.size !== 0) {
    return;
  }
  console.log(mapping.hash, 'terminate');
  sub.unsubscribe();
  activeSubscriptions.delete(mapping.hash);
}

const client = createClient({
  url: 'http://localhost:3001/graphql',
  credentials: 'include',
});

onconnect = (event: MessageEvent) => {
  const port = event.ports[0];

  /** All IDs retained by this port */
  const portOperationIds = new Set<string>();

  /** If Tab closes we need to do some cleanup :) */
  function scheduleTimeout() {
    console.log('send ping');
    let timeout = setTimeout(() => {
      console.log('timeout clean up operations for port');
      for (const operationId of portOperationIds) {
        endOperation(operationId);
      }
    }, 5000);

    port.postMessage(JSON.stringify({ type: 'ping' } as WorkerPing));

    return timeout;
  }

  let timeout = scheduleTimeout();

  port.onmessage = async event => {
    const data: WorkerEvent = JSON.parse(event.data);

    switch (data.type) {
      case 'pong': {
        console.log('received pong');

        clearTimeout(timeout);
        setTimeout(() => {
          timeout = scheduleTimeout();
        }, 5000);

        return;
      }
      case 'subscriptionStart': {
        const hash = await getDedupeHash(data.graphql);
        console.log(hash, data.id, 'subscribe');

        const subscriptionsForHash = activeSubscriptions.get(hash);

        if (subscriptionsForHash) {
          subscriptionsForHash.ids.add(data.id);
          idToHashAndPortMapping.set(data.id, { hash, port });
          portOperationIds.add(data.id);
          return;
        }

        const unsubscribe = client.subscribe(
          {
            query: data.graphql.query!,
            variables: data.graphql.variables,
            operationName: data.graphql.operationName,
            extensions: data.graphql.extensions,
          },
          {
            next(result) {
              const subs = activeSubscriptions.get(hash);
              console.log(hash, 'next', result);

              if (!subs) {
                return;
              }

              for (const id of subs.ids) {
                const mapping = idToHashAndPortMapping.get(id);
                if (!mapping) {
                  continue;
                }
                mapping.port.postMessage(
                  JSON.stringify({
                    type: 'next',
                    id,
                    result,
                  } satisfies WorkerNextResponse),
                );
              }
            },
            error(err) {
              console.error(err);

              // TODO: check if we should forward error to main thread
              // NOTE: we probably need to as we need to refresh the access - instead of doing it for every tab we should probably only one to avoid ddossing our own server
            },
            complete() {
              const subs = activeSubscriptions.get(hash);
              console.log(hash, 'complete');

              if (!subs) {
                return;
              }
              for (const id of subs.ids) {
                const mapping = idToHashAndPortMapping.get(id);
                if (!mapping) {
                  continue;
                }
                mapping.port.postMessage(
                  JSON.stringify({
                    type: 'complete',
                    id,
                  } satisfies WorkerCompleteResponse),
                );

                // TODO: check if we need to do additional cleanup
              }
            },
          },
        );
        activeSubscriptions.set(hash, {
          ids: new Set([data.id]),
          unsubscribe,
        });
        idToHashAndPortMapping.set(data.id, { hash, port });
        portOperationIds.add(data.id);

        return;
      }
      case 'subscriptionEnd': {
        console.log(data.id, 'unsubscribe');
        portOperationIds.delete(data.id);
        endOperation(data.id);
        return;
      }
    }
  };
};
