import { Injectable, Scope } from 'graphql-modules';
import LRU from 'lru-cache';
import { HiveError } from '../../../shared/errors';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';

@Injectable({
  scope: Scope.Singleton,
})
export class InMemoryRateLimitStore {
  limiters = new Map<
    string,
    {
      windowSize: number;
      maxActions: number;
      limiter: SlidingWindowRateLimiter;
    }
  >();

  ensureLimiter(action: string, windowSize: number, maxActions: number) {
    const existing = this.limiters.get(action);
    if (existing) {
      if (existing.maxActions !== maxActions || existing.windowSize !== windowSize) {
        throw new Error(
          `Rate limiter for action "${action}" already exists with different window size or max actions.`,
        );
      }

      return existing.limiter;
    }

    const limiter = new SlidingWindowRateLimiter(windowSize, maxActions);
    this.limiters.set(action, {
      windowSize,
      maxActions,
      limiter,
    });

    return limiter;
  }
}

@Injectable({
  global: true,
  scope: Scope.Operation,
})
export class InMemoryRateLimiter {
  constructor(
    private logger: Logger,
    private store: InMemoryRateLimitStore,
    private authManager: AuthManager,
  ) {
    this.logger = logger.child({ service: 'InMemoryRateLimiter' });
  }

  async check(action: string, windowSizeInMs: number, maxActions: number, message: string) {
    this.logger.debug(
      'Checking rate limit (action:%s, windowsSize: %s, maxActions: %s)',
      action,
      windowSizeInMs,
      maxActions,
    );
    if (!this.authManager.isUser()) {
      throw new Error('Expected to be called for an authenticated user.');
    }

    const user = await this.authManager.getCurrentUser();
    const limiter = this.store.ensureLimiter(action, windowSizeInMs, maxActions);

    if (!limiter.isAllowed(user.id)) {
      throw new HiveError(message);
    }
  }
}

class SlidingWindowRateLimiter {
  private windowSize: number;
  private maxActions: number;
  private userActions: LRU<string, number[]>;

  constructor(windowSize: number, maxActions: number) {
    this.windowSize = windowSize;
    this.maxActions = maxActions;
    this.userActions = new LRU({
      max: 500,
      maxAge: windowSize,
    });
  }

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userTimestamps = this.userActions.get(userId) || [];

    const recentTimestamps: number[] = [];

    // Remove timestamps that are outside the sliding window
    for (let index = userTimestamps.length - 1; index >= 0; index--) {
      const timestamp = userTimestamps[index];

      if (now - timestamp <= this.windowSize) {
        recentTimestamps.unshift(timestamp);
      } else {
        // Stop when we reach the first timestamp outside the window.
        // This is because the timestamps are ordered from most recent to oldest
        // (We iterate from the end of the array)
        break;
      }
    }

    // Add the current timestamp to the list
    recentTimestamps.push(now);

    // Update the user's timestamp list
    this.userActions.set(userId, recentTimestamps);

    // Check if the number of actions is within the allowed limit
    return recentTimestamps.length <= this.maxActions;
  }
}
