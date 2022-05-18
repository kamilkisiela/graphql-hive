import { metrics } from '@hive/service-common';

export const validateCounter = new metrics.Counter({
  name: 'schema_validate_total',
  help: 'Number of call to validate schema',
  labelNames: ['type'],
});

export const buildCounter = new metrics.Counter({
  name: 'schema_build_total',
  help: 'Number of call to build schema',
  labelNames: ['type'],
});

export const supergraphCounter = new metrics.Counter({
  name: 'schema_supergraph_total',
  help: 'Number of call to build supergraph',
  labelNames: ['type'],
});
