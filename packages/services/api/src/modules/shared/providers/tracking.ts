import { Injectable, Scope, Inject, Optional, InjectionToken } from 'graphql-modules';
import * as Sentry from '@sentry/node';
import { fetch } from '@whatwg-node/fetch';
import type { Organization } from '../../../shared/entities';
import { Storage } from './storage';

type EventType =
  | 'created-project'
  | 'published-schema'
  | 'checked-schema'
  | 'invited-member'
  | 'reported-operations'
  | 'enabled-usage-checking';

type OriginalEventType = Exclude<keyof Organization['getStarted'], 'id'>;

type Mapping = Record<OriginalEventType, EventType>;

const mapping: Mapping = {
  creatingProject: 'created-project',
  publishingSchema: 'published-schema',
  checkingSchema: 'checked-schema',
  invitingMembers: 'invited-member',
  reportingOperations: 'reported-operations',
  enablingUsageBasedBreakingChanges: 'enabled-usage-checking',
};

export const TRACKING_KEY = new InjectionToken<string>('TRACKING_KEY');

@Injectable({
  scope: Scope.Singleton,
})
export class Tracking {
  constructor(private storage: Storage, @Optional() @Inject(TRACKING_KEY) private apiKey?: string) {}

  async track(event: { type: OriginalEventType; orgId: string }) {
    const updated = await this.storage.completeGetStartedStep({
      organization: event.orgId,
      step: event.type,
    });

    if (!this.apiKey || !updated) {
      return;
    }

    void fetch('https://api.graphjson.com/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        collection: 'features',
        json: JSON.stringify({
          event: mapping[event.type],
          org_id: event.orgId,
        }),
        timestamp: Math.floor(new Date().getTime() / 1000),
      }),
    }).catch(error => Sentry.captureException(error));
  }
}
