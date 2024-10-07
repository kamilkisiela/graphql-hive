import { metrics } from '@hive/service-common';

export const emailsTotal = new metrics.Counter({
  name: 'emails_total',
  help: 'Number of sent emails',
});

export const emailsFailuresTotal = new metrics.Counter({
  name: 'emails_failures_total',
  help: 'Number of failures',
});
