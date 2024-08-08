import type { JobSpec, TransmissionAPI } from '@hive/transmission';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { env } from './environment';

function sharedJobSpec(input: {
  event: 'warning' | 'exceeded';
  organizationId: string;
  period: {
    start: number;
    end: number;
  };
  limit: number;
}): JobSpec {
  return {
    // Shared jobKey and `jobKeyMode: 'replace'`, makes sure the latest email wins
    // (in case we warn and after a short period of time, rate limit).
    jobKey: `rate-limit-${input.organizationId}`,
    jobKeyMode: 'replace',
    maxAttempts: 10,
    // The key includes all necessary information to make sure we don't send an email
    // about the same thing multiple times within the same context.
    // By context I mean:
    // - billing period (when a new billing period starts, we can send an email again)
    // - limits (when user updates the limit, we can send an email again)
    monthlyDedupeKey: JSON.stringify({
      event: input.event,
      organizationId: input.organizationId,
      period: input.period,
      limit: input.limit,
    }),
  };
}

export function createEmailScheduler(transmissionEndpoint: string) {
  const api = createTRPCProxyClient<TransmissionAPI>({
    links: [
      httpLink({
        url: `${transmissionEndpoint}/trpc`,
        fetch,
      }),
    ],
  });

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
      return scheduledEmails.push(
        api.emailTask.mutate({
          payload: {
            to: input.organization.email,
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
          },
          spec: sharedJobSpec({
            event: 'exceeded',
            organizationId: input.organization.id,
            period: input.period,
            limit: input.usage.quota,
          }),
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
      return scheduledEmails.push(
        // prevent sending the same email multiple times
        api.emailTask.mutate({
          payload: {
            to: input.organization.email,
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
          },
          spec: sharedJobSpec({
            event: 'warning',
            organizationId: input.organization.id,
            period: input.period,
            limit: input.usage.quota,
          }),
        }),
      );
    },
  };
}
