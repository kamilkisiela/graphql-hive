import { createHash } from 'crypto';
import type { Job, Queue } from 'bullmq';
import { got } from 'got';
import type { WebhookInput } from './scheduler';
import type { Config } from './types';

export async function scheduleWebhook({
  queue,
  webhook,
  config,
}: {
  webhook: WebhookInput;
  config: Config;
  queue: Queue;
}) {
  const checksum = createHash('sha256').update(JSON.stringify(webhook)).digest('hex');
  const jobName = `${webhook.event.target.id}-${checksum}`;
  config.logger.debug(`Schedule ${jobName}`);

  return queue
    .add(jobName, webhook, {
      jobId: jobName,
      attempts: config.maxAttempts,
      backoff: { type: 'exponential', delay: config.backoffDelay },
    })
    .then(result => {
      config.logger.debug(`Scheduled ${jobName}`);
      return Promise.resolve(result);
    });
}

export function createWebhookJob({ config }: { config: Config }) {
  return async function sendWebhook(job: Job<WebhookInput>) {
    if (job.attemptsMade < config.maxAttempts) {
      config.logger.debug(
        'Calling webhook (job=%s, attempt=%d of %d)',
        job.name,
        job.attemptsMade,
        config.maxAttempts,
      );

      if (config.requestBroker) {
        await got.post(config.requestBroker.endpoint, {
          headers: {
            Accept: 'text/plain',
            'x-hive-signature': config.requestBroker.signature,
          },
          timeout: {
            request: 10_000,
          },
          json: {
            url: job.data.endpoint,
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate, br',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(job.data.event),
            resolveResponseBody: false,
          },
        });
      } else {
        await got.post(job.data.endpoint, {
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json',
          },
          timeout: {
            request: 10_000,
          },
          json: job.data.event,
        });
      }
    } else {
      config.logger.warn('Giving up on webhook (job=%s)', job.name);
    }
  };
}
