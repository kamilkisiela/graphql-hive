import { metrics } from '@hive/service-common';

export const normalizeCacheMisses = new metrics.Counter({
  name: 'usage_ingestor_normalize_cache_misses',
  help: 'Number of cache misses when normalizing operations',
});

export const schemaCoordinatesSize = new metrics.Summary({
  name: 'usage_ingestor_schema_coordinates_size',
  help: 'Size of schema coordinates',
});

export const totalOperations = new metrics.Counter({
  name: 'usage_ingestor_operations_total',
  help: 'Number of raw operations received by usage ingestor service',
});

export const processDuration = new metrics.Histogram({
  name: 'usage_ingestor_process_duration_seconds',
  help: 'Time spent processing and writing reports',
});

export const writeDuration = new metrics.Histogram({
  name: 'usage_ingestor_write_duration_seconds',
  help: 'Time spent writing reports',
  labelNames: ['query', 'destination', 'status'],
});

export const errors = new metrics.Counter({
  name: 'usage_ingestor_errors',
  help: 'Number of errors occurred during processing and writing reports',
});

export const reportMessageBytes = new metrics.Summary({
  name: 'usage_ingestor_report_message_bytes',
  help: 'Size (in bytes) of a "usage_reports" topic message received by ingestor service',
});

export const reportSize = new metrics.Summary({
  name: 'usage_ingestor_report_size',
  help: 'Number of operations per report received by ingestor service',
});

export const reportMessageSize = new metrics.Summary({
  name: 'usage_ingestor_report_message_size',
  help: 'Number of reports in the "usage_reports" message received by ingestor service',
});

export const ingestedOperationsWrites = new metrics.Counter({
  name: 'usage_ingested_operation_writes',
  help: 'Number of successfully ingested operations',
});

export const ingestedOperationsFailures = new metrics.Counter({
  name: 'usage_ingested_operation_failures',
  help: 'Number of failed to ingest operations',
});

export const ingestedOperationRegistryWrites = new metrics.Counter({
  name: 'usage_ingested_operation_registry_writes',
  help: 'Number of successfully ingested registry records',
});

export const ingestedOperationRegistryFailures = new metrics.Counter({
  name: 'usage_ingested_operation_registry_failures',
  help: 'Number of failed to ingest registry records',
});
