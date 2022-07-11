import { metrics } from '@hive/service-common';

export const rateLimitOperationsEventOrg = new metrics.Counter({
  name: 'rate_limited_operations_events_count',
  help: 'Rate limit events per org id, for operations.',
  labelNames: ['orgId', 'orgName'],
});
