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

export const processTime = new metrics.Summary({
  name: 'usage_ingestor_process_time',
  help: 'Time spent processing and serializing reports',
});

export const writeTime = new metrics.Summary({
  name: 'usage_ingestor_write_time',
  help: 'Time spent writing reports',
  labelNames: ['table'],
});

export const flushes = new metrics.Counter({
  name: 'usage_ingestor_flushes',
  help: 'Number of flushes',
  labelNames: ['reason'],
});

export const flushSize = new metrics.Summary({
  name: 'usage_ingestor_flush_bytes',
  help: 'Size (in bytes) of a flush',
  labelNames: ['reason'],
});

export const flushOperationsSize = new metrics.Summary({
  name: 'usage_ingestor_flush_operations_size',
  help: 'Size of flushed rows to operations table',
  labelNames: ['reason'],
});

export const flushOperationCollectionSize = new metrics.Summary({
  name: 'usage_ingestor_flush_operation_collection_size',
  help: 'Size of flushed rows to operation_collection table',
  labelNames: ['reason'],
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
