import { Injectable, Scope } from 'graphql-modules';
import * as Sentry from '@sentry/node';
import { AuthManager } from '../../auth/providers/auth-manager';
import { track } from '../../../shared/mixpanel';

@Injectable({
  scope: Scope.Operation,
})
export class Tracking {
  constructor(private authManager: AuthManager) {}

  async track(event: {
    event: string;
    data?: Record<string, any>;
    user?: {
      id: string;
      superTokensUserId: string | null;
    };
  }) {
    try {
      track({
        event: event.event,
        distinct_id: event.user?.superTokensUserId ?? (await this.authManager.getUserIdForTracking()),
        data: event.data,
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  }
}
