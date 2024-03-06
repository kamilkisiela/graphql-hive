import type { EmailsApi } from '@hive/emails';
import { createTimeoutHTTPLink } from '@hive/service-common';
import { createTRPCProxyClient } from '@trpc/client';
import { env } from './environment';

export function createEmailScheduler(config?: { endpoint: string }) {
  const api = config?.endpoint
    ? createTRPCProxyClient<EmailsApi>({
        links: [
          createTimeoutHTTPLink({
            url: `${config.endpoint}/trpc`,
            fetch,
          }),
        ],
      })
    : null;

  const numberFormatter = new Intl.NumberFormat();
  let scheduledEmails: Promise<unknown>[] = [];

  return {
    drain() {
      const drained = [...scheduledEmails];
      scheduledEmails = [];
      return drained;
    },
    limitExceeded(input: {
      organization: {
        name: string;
        id: string;
        cleanId: string;
        email: string;
      };
      period: {
        start: number;
        end: number;
      };
      usage: {
        quota: number;
        current: number;
      };
    }) {
      if (!api) {
        return scheduledEmails.push(Promise.resolve());
      }

      return scheduledEmails.push(
        api.schedule.mutate({
          email: input.organization.email,
          // If the jobId would include only the period and org id, then we would be able to notify the user once per month.
          // There's a chance that an organization will increase the limit and we might need to notify them again.
          id: JSON.stringify({
            id: 'rate-limit-exceeded',
            organization: input.organization.id,
            period: input.period,
            limit: input.usage.quota,
          }),
          subject: `GraphQL-Hive operations quota for ${input.organization.name} exceeded`,
          body: `
          <mjml>
            <mj-body>
              <mj-section>
                <mj-column>
                  <mj-image width="150px" src="https://graphql-hive.com/logo.png"></mj-image>
                  <mj-divider border-color="#ca8a04"></mj-divider>
                  <mj-text>
                    Your Hive organization <strong>${
                      input.organization.name
                    }</strong> has reached over 100% of the operations limit quota.
                    Used ${numberFormatter.format(input.usage.current)} of ${numberFormatter.format(
                      input.usage.quota,
                    )}.
                  </mj-text>.
                  <mj-text>
                    We recommend to increase the limit.
                  </mj-text>
                  <mj-button href="${env.hiveServices.webAppUrl}/${
                    input.organization.cleanId
                  }/view/subscription">
                    Manage your subscription
                  </mj-button>
                </mj-column>
              </mj-section>
            </mj-body>
          </mjml>
        `,
        }),
      );
    },

    limitWarning(input: {
      organization: {
        name: string;
        id: string;
        cleanId: string;
        email: string;
      };
      period: {
        start: number;
        end: number;
      };
      usage: {
        quota: number;
        current: number;
      };
    }) {
      if (!api) {
        return scheduledEmails.push(Promise.resolve());
      }

      return scheduledEmails.push(
        api.schedule.mutate({
          email: input.organization.email,
          // If the jobId would include only the period and org id, then we would be able to notify the user once per month.
          // There's a chance that an organization will increase the limit and we might need to notify them again.
          id: JSON.stringify({
            id: 'rate-limit-warning',
            organization: input.organization.id,
            period: input.period,
            limit: input.usage.quota,
          }),
          subject: `${input.organization.name} is approaching its rate limit`,
          body: `
          <mjml>
            <mj-body>
              <mj-section>
                <mj-column>
                  <mj-image width="150px" src="https://graphql-hive.com/logo.png"></mj-image>
                  <mj-divider border-color="#ca8a04"></mj-divider>
                  <mj-text>
                    Your organization <strong>${
                      input.organization.name
                    }</strong> is approaching its operations limit quota.
                    Used ${numberFormatter.format(input.usage.current)} of ${numberFormatter.format(
                      input.usage.quota,
                    )}.
                  </mj-text>.
                  <mj-text>
                    We recommend to increase the limit.
                  </mj-text>
                  <mj-button href="${env.hiveServices.webAppUrl}/${
                    input.organization.cleanId
                  }/view/subscription">
                    Manage your subscription
                  </mj-button>
                </mj-column>
              </mj-section>
            </mj-body>
          </mjml>
        `,
        }),
      );
    },
  };
}
