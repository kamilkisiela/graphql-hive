import { metrics } from '@the-guild-org/hive-service-common';

export const policyCheckCounter = new metrics.Counter({
  name: 'policy_check_total',
  help: 'Number of call to policy check',
});
