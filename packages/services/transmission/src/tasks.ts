import { monthlyDeduplicationCleanupTask } from './lib/monthly-deduplication.js';
import { createProcedure, router } from './lib/trpc.js';
import { AddJobFn, tasksFactory } from './lib/utils.js';
import { sendEmailTask } from './tasks/notifications/email.js';
import { emailsFailuresTotal } from './tasks/notifications/email/metrics.js';
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from './tasks/notifications/email/procedures.js';
import { sendMSTeamsWebhook } from './tasks/notifications/ms-teams.js';
import { sendSlackMessageTask } from './tasks/notifications/slack.js';
import { sendWebhookTask } from './tasks/notifications/webhook.js';

export const tasks = tasksFactory()
  .addTask('monthlyDeduplicationCleanupTask', monthlyDeduplicationCleanupTask)
  .addTask('sendEmail', sendEmailTask, {
    'job:failed': _ => {
      // when a job fails after all retries,
      // we increment the failure counter
      emailsFailuresTotal.inc();
    },
  })
  .addTask('sendSlackMessage', sendSlackMessageTask)
  .addTask('sendMSTeamsWebhook', sendMSTeamsWebhook)
  .addTask('sendWebhook', sendWebhookTask);

const taskSchemas = tasks.getTaskPayloadSchemaList();
export type TaskSchemas = typeof taskSchemas;

export const taskRouter = router({
  sendWebhook: createProcedure(taskSchemas, 'sendWebhook'),
  sendEmail: createProcedure(taskSchemas, 'sendEmail'),
  sendSlackMessage: createProcedure(taskSchemas, 'sendSlackMessage'),
  sendMSTeamsWebhook: createProcedure(taskSchemas, 'sendMSTeamsWebhook'),
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
});

// utils

export const addJob: AddJobFn<typeof tasks> = async (helpers, taskName, payload, spec) => {
  return helpers.addJob(taskName as string, payload, spec);
};
