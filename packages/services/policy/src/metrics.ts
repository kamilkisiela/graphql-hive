import { metrics } from '@hive/service-common';

export const policyCheckCounter = new metrics.Counter({
  name: 'policy_check_total',
  help: 'Number of calls to policy check service',
  labelNames: ['target'],
});

export const policyCheckDuration = new metrics.Histogram({
  name: 'schema_policy_check_duration',
  help: 'Duration of schema policy check',
  labelNames: ['target'],
});
