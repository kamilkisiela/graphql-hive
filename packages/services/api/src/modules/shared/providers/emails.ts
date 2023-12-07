import { Inject, Injectable, InjectionToken, Optional } from 'graphql-modules';
import type { EmailsApi, EmailsApiInput } from '@hive/emails';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

export const EMAILS_ENDPOINT = new InjectionToken<string>('EMAILS_ENDPOINT');

@Injectable()
export class Emails {
  private api;

  constructor(@Optional() @Inject(EMAILS_ENDPOINT) endpoint?: string) {
    this.api = endpoint
      ? createTRPCProxyClient<EmailsApi>({
          links: [
            httpLink({
              url: `${endpoint}/trpc`,
              fetch,
            }),
          ],
        })
      : null;
  }

  schedule(input: EmailsApiInput['schedule']) {
    if (!this.api) {
      return Promise.resolve();
    }

    return this.api.schedule.mutate(input);
  }
}
