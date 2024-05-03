import { createClient, type Client as SSEClient } from 'graphql-sse';
import stringify from 'quick-stable-stringify';

export type WorkerSubscriptionSubscribeEvent = {
  type: 'subscriptionStart';
  id: string;
  graphql: {
    query?: string;
    operationName?: string;
    variables?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
  };
};

export type WorkerSubscriptionUnsubscribeEvent = {
  type: 'subscriptionEnd';
  id: string;
};

/** Sent by tab to worker to see if worker is still alive. */
export type WorkerPongEvent = {
  type: 'pong';
};

export type WorkerCloseEvent = {
  type: 'close';
};

export type WorkerConfigurationEvent = {
  type: 'configuration';
  url: string;
};

/** Messages sent from port/tab/window -> worker */
export type WorkerReceiveMessage =
  | WorkerSubscriptionSubscribeEvent
  | WorkerSubscriptionUnsubscribeEvent
  | WorkerConfigurationEvent
  | WorkerCloseEvent
  | WorkerPongEvent;

export type WorkerNextResponse = {
  type: 'next';
  id: string;
  result: any;
};

export type WorkerPing = {
  type: 'ping';
};

export type WorkerCompleteResponse = {
  type: 'complete';
  id: string;
};

/** Messages sent from worker -> port/tab/window */
export type WorkerSendMessage = WorkerNextResponse | WorkerCompleteResponse | WorkerPing;

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
const operationIdToHashAndPortMapping = new Map<
  string,
  {
    hash: string;
    port: MessagePort;
  }
>();

async function hashValue(value: string): Promise<string> {
  const arrayBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hexes: Array<string> = [];
  const view = new DataView(arrayBuffer);
  for (let i = 0; i < view.byteLength; i += 4) {
    hexes.push(('00000000' + view.getUint32(i).toString(16)).slice(-8));
  }
  return hexes.join('');
}

async function getDedupeHash(data: WorkerSubscriptionSubscribeEvent['graphql']): Promise<string> {
  return hashValue(stringify(data)!);
}

/** End an operation with a specific id. */
function endOperation(id: string) {
  const mapping = operationIdToHashAndPortMapping.get(id);
  if (!mapping) {
    return;
  }
  const sub = activeSubscriptions.get(mapping.hash);
  if (!sub) {
    return;
  }

  operationIdToHashAndPortMapping.delete(id);
  sub.ids.delete(id);
  if (sub.ids.size !== 0) {
    return;
  }
  console.log(mapping.hash, 'terminate');
  sub.unsubscribe();
  activeSubscriptions.delete(mapping.hash);
}

/** Handle operation result streamed from the server */
function handleNext(hash: string, result: any) {
  const subs = activeSubscriptions.get(hash);
  if (!subs) {
    return;
  }

  for (const id of subs.ids) {
    const mapping = operationIdToHashAndPortMapping.get(id);
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
}

/** Handle operation that is completed by the server */
function handleComplete(hash: string) {
  const subs = activeSubscriptions.get(hash);
  if (!subs) {
    return;
  }

  for (const id of subs.ids) {
    const mapping = operationIdToHashAndPortMapping.get(id);
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
}

let client: SSEClient;

const self = globalThis as unknown as SharedWorkerGlobalScope;

self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];

  /** All IDs retained by this port */
  const portOperationIds = new Set<string>();

  /** if tab/window becomes unresponsive, we need to do some cleanup :) */
  function scheduleTimeout() {
    console.log('send ping');
    const timeout = setTimeout(() => {
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
    const data: WorkerReceiveMessage = JSON.parse(event.data);

    switch (data.type) {
      case 'configuration': {
        console.log('received configuration', data);
        if (client) {
          console.log('client already configured');
          return;
        }
        client = createClient({
          url: data.url,
          credentials: 'include',
        });
        return;
      }
      case 'pong': {
        console.log('received pong');

        clearTimeout(timeout);
        setTimeout(() => {
          timeout = scheduleTimeout();
        }, 5000);

        return;
      }
      case 'close': {
        console.log('received close');
        clearTimeout(timeout);
        for (const operationId of portOperationIds) {
          endOperation(operationId);
        }
        return;
      }
      case 'subscriptionStart': {
        const hash = await getDedupeHash(data.graphql);
        console.log(hash, data.id, 'subscribe');

        const subscriptionsForHash = activeSubscriptions.get(hash);

        if (subscriptionsForHash) {
          subscriptionsForHash.ids.add(data.id);
          operationIdToHashAndPortMapping.set(data.id, { hash, port });
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
              console.log(hash, 'next', result);
              handleNext(hash, result);
            },
            error(err) {
              console.error(err);
              // TODO: check if we should forward error to main thread
              // what are potential errors?
            },
            complete() {
              console.log(hash, 'complete');
              handleComplete(hash);
            },
          },
        );
        activeSubscriptions.set(hash, {
          ids: new Set([data.id]),
          unsubscribe,
        });
        operationIdToHashAndPortMapping.set(data.id, { hash, port });
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
