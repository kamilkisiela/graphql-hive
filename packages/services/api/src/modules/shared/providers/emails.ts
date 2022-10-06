import { Injectable, InjectionToken, Inject, Optional } from 'graphql-modules';
import { fetch } from '@whatwg-node/fetch';
import { createTRPCClient, TRPCClient } from '@trpc/client';
import type { EmailsApi, EmailScheduleInput } from '@hive/emails';

export const EMAILS_ENDPOINT = new InjectionToken<string>('EMAILS_ENDPOINT');

@Injectable()
export class Emails {
  private api: TRPCClient<EmailsApi> | null;

  constructor(@Optional() @Inject(EMAILS_ENDPOINT) endpoint?: string) {
    this.api = endpoint
      ? createTRPCClient<EmailsApi>({
          url: `${endpoint}/trpc`,
          fetch,
        })
      : null;
  }

  schedule(input: EmailScheduleInput) {
    if (!this.api) {
      return Promise.resolve();
    }

    return this.api.mutation('schedule', input);
  }
}
