import { useSyncExternalStore } from 'react';
import { Exchange, Operation } from 'urql';
import { map, pipe, tap } from 'wonka';

const inflightRequests = new Set<number>();
const listeners = new Set<() => void>();
let inflightCount = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return inflightCount;
}

export const useInflightRequests = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

function end(key: number) {
  inflightRequests.delete(key);
  update();
}

function start(key: number) {
  inflightRequests.add(key);
  update();
}

let scheduled = false;

// urql dispatches from inside a component's render, so notifying there would update the indicator
// mid-render. The count moves only with the notify, so a snapshot never changes unannounced.
function update() {
  if (scheduled) {
    return;
  }
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    inflightCount = inflightRequests.size;
    for (const listener of listeners) {
      listener();
    }
  });
}

function getUniqueKey(op: Operation) {
  return op.key;
}

export const networkStatusExchange: Exchange = ({ forward }) => {
  return operations$ => {
    const forward$ = pipe(
      operations$,
      map(op => {
        // Subscriptions are long-lived, and a preload (a route loader run on hover) is not
        // something the viewer is waiting for; neither shows in the bar.
        if (op.kind === 'subscription' || op.context.preload === true) {
          return op;
        }
        if (op.kind === 'teardown') {
          end(getUniqueKey(op));
        } else {
          start(getUniqueKey(op));
        }

        return op;
      }),
    );

    return pipe(
      forward(forward$),
      tap(result => {
        setTimeout(() => {
          end(getUniqueKey(result.operation));
        }, 100);
      }),
    );
  };
};
