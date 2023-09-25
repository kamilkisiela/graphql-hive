import { metrics } from '@hive/service-common';

export const composeAndValidateCounter = new metrics.Counter({
  name: 'schema_compose_and_validate_total',
  help: 'Number of calls to compose and validate schemas',
  labelNames: ['type'],
});

export const externalCompositionCounter = new metrics.Counter({
  name: 'schema_external_composition_total',
  help: 'Number of external compositions',
  labelNames: ['cache' /* hit or miss */, 'type' /* success, failure or timeout */],
});
