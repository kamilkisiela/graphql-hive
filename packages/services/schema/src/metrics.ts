import { metrics } from '@hive/service-common';

export const composeAndValidateCounter = new metrics.Counter({
  name: 'schema_compose_and_validate_total',
  help: 'Number of call to compose and validate schemas',
  labelNames: ['type'],
});
