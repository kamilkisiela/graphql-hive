import type { Exchange, Operation } from 'urql';
import { map, pipe, tap } from 'wonka';
import { proxy, useSnapshot } from 'valtio';

const inflightRequests = new Set<number>();

const NetworkState = proxy({
  inflightRequests: 0,
});

export const useInflightRequests = () => {
  const state = useSnapshot(NetworkState);
  return state.inflightRequests;
};

function end(key: number) {
  inflightRequests.delete(key);
  update();
}

function start(key: number) {
  inflightRequests.add(key);
  update();
}

function update() {
  NetworkState.inflightRequests = inflightRequests.size;
}

function getUniqueKey(op: Operation) {
  return op.key;
}

export const networkStatusExchange: Exchange = ({ forward }) => {
  return operations$ => {
    const forward$ = pipe(
      operations$,
      map(op => {
        if (op.kind === 'teardown') {
          end(getUniqueKey(op));
        } else {
          start(getUniqueKey(op));
        }

        return op;
      })
    );

    return pipe(
      forward(forward$),
      tap(result => {
        setTimeout(() => {
          end(getUniqueKey(result.operation));
        }, 100);
      })
    );
  };
};
