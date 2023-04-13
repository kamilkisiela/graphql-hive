import { fetch } from '@whatwg-node/fetch';
import { invariant } from './helpers';

type Heartbeats = () => void;

interface HeartbeatsConfigEnabled {
  enabled: true;
  endpoint: string;
  intervalInMS: number;
  onError(error: Error): void;
  /**
   * Sends a heartbeat to the endpoint only if the condition is true, skips a heartbeat if the condition is false.
   */
  isReady(): boolean | Promise<boolean>;
}

interface HeartbeatsConfigDisabled {
  enabled: false;
}

function isEnabled(config: { enabled: boolean }): config is HeartbeatsConfigEnabled {
  return config.enabled === true;
}

/**
 * Used for sending heartbeats to the Status Page.
 */
export function startHeartbeats(config: HeartbeatsConfigEnabled): Heartbeats;
export function startHeartbeats(config: HeartbeatsConfigDisabled): Heartbeats;
export function startHeartbeats(config: { enabled: boolean }): Heartbeats {
  if (!isEnabled(config)) {
    return function stop() {};
  }

  const { endpoint, intervalInMS, onError, isReady } = config;

  invariant(typeof endpoint === 'string', '[startHeartbeats] endpoint is required');
  invariant(typeof intervalInMS === 'number', '[startHeartbeats] intervalInMS is required');
  invariant(typeof onError === 'function', '[startHeartbeats] onError is required');

  let interval: ReturnType<typeof setTimeout> | undefined;

  async function beat() {
    try {
      if (await isReady()) {
        await fetch(endpoint, { method: 'GET' });
      }
    } catch (error) {
      onError(error as any);
    }
  }

  function tick() {
    void beat().finally(() => schedule());
  }

  function schedule() {
    interval = setTimeout(tick, intervalInMS);
  }

  tick();

  return function stop() {
    if (interval) {
      clearTimeout(interval);
    }
  };
}
