import { monthlyDeduplicationCleanupTask } from './monthly-deduplication';
import { sendEmailTask } from './notifications/email';
import { emailsFailuresTotal } from './notifications/email/metrics';
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from './notifications/email/procedures';
import { sendMSTeamWebhook as sendMSTeamsWebhook } from './notifications/ms-teams';
import { sendSlackMessageTask } from './notifications/slack';
import { sendWebhookTask } from './notifications/webhook';
import { createProcedure, router } from './trpc';
import { AddJobFn, createTaskList } from './utils';

export const taskList = createTaskList()
  .addTask('monthlyDeduplicationCleanupTask', monthlyDeduplicationCleanupTask)
  .addTask('sendEmail', sendEmailTask, {
    'job:failed': _ => {
      // when a job fails, after all retries, we increment the failure counter
      emailsFailuresTotal.inc();
    },
  })
  .addTask('sendSlackMessage', sendSlackMessageTask)
  .addTask('sendMSTeamsWebhook', sendMSTeamsWebhook)
  .addTask('sendWebhook', sendWebhookTask);

const taskSchemas = taskList.getTaskPayloadSchemaList();
export type TaskSchemas = typeof taskSchemas;

export const taskRouter = router({
  webhookTask: createProcedure('sendWebhook', taskSchemas.sendWebhook),
  emailTask: createProcedure('sendEmail', taskSchemas.sendEmail),
  slackTask: createProcedure('sendSlackMessage', taskSchemas.sendSlackMessage),
  msTeamsTask: createProcedure('sendMSTeamsWebhook', taskSchemas.sendMSTeamsWebhook),
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
});

// utils

export const addJob: AddJobFn<typeof taskList> = async (helpers, taskName, payload, spec) => {
  return helpers.addJob(taskName as string /* FIXME: later */, payload, spec);
};
