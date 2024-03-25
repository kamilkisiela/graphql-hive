import { metrics } from '@hive/service-common';

export const tokenCacheHits = new metrics.Counter({
  name: 'usage_tokens_cache_hits',
  help: 'Number of cache hits',
});

export const tokenRequests = new metrics.Counter({
  name: 'usage_tokens_requests',
  help: 'Number of requests to Tokens service',
});

export const tokensDuration = new metrics.Histogram({
  name: 'usage_tokens_duration_seconds',
  help: 'Duration of an HTTP Request to Tokens service in seconds',
  labelNames: ['status'],
});

export const httpRequests = new metrics.Counter({
  name: 'usage_http_requests',
  help: 'Number of http requests',
});

export const httpRequestsWithoutToken = new metrics.Counter({
  name: 'usage_http_requests_no_token',
  help: 'Number of http requests without a token',
});

export const httpRequestsWithNonExistingToken = new metrics.Counter({
  name: 'usage_http_requests_invalid_token',
  help: 'Number of http requests with a non existing token',
});

export const httpRequestsWithNoAccess = new metrics.Counter({
  name: 'usage_http_requests_no_access',
  help: 'Number of http requests with a token with no access',
});

export const totalOperations = new metrics.Counter({
  name: 'usage_operations_total',
  help: 'Number of operations received by usage service',
});

export const totalReports = new metrics.Counter({
  name: 'usage_reports_total',
  help: 'Number of reports received by usage service',
});

export const droppedReports = new metrics.Counter({
  name: 'usage_rate_limit_dropped',
  help: 'Number of reports dropped by usage service due to rate-limit',
  labelNames: ['targetId', 'orgId'],
});

export const totalLegacyReports = new metrics.Counter({
  name: 'usage_reports_legacy_format_total',
  help: 'Number of legacy-format reports received by usage service',
});

export const rawOperationWrites = new metrics.Counter({
  name: 'usage_operation_writes',
  help: 'Number of raw operations successfully collected by usage service',
});

export const rawOperationFailures = new metrics.Gauge({
  name: 'usage_operation_failures',
  help: 'Number of raw operations NOT collected by usage service',
});

export const invalidRawOperations = new metrics.Counter({
  name: 'usage_operations_invalid',
  help: 'Number of invalid raw operations dropped by usage service',
  labelNames: ['reason'],
});

export const collectDuration = new metrics.Histogram({
  name: 'usage_raw_collect_duration_seconds',
  help: 'Collect duration in seconds',
  labelNames: ['status'],
});

export const compressDuration = new metrics.Histogram({
  name: 'usage_raw_compress_duration_seconds',
  help: 'Compress duration in seconds',
});

export const kafkaDuration = new metrics.Histogram({
  name: 'usage_raw_kafka_duration_seconds',
  help: 'Kafka duration in seconds',
});

export const bufferFlushes = new metrics.Counter({
  name: 'usage_buffer_flushes',
  help: 'Number of buffer flushes',
});

export const rawOperationsSize = new metrics.Summary({
  name: 'usage_raw_operation_size',
  help: 'Size of a sent batch',
});

export const estimationError = new metrics.Summary({
  name: 'usage_size_estimation_error',
  help: 'How far off the estimation was comparing to the actual size',
});

export const usedAPIVersion = new metrics.Counter({
  name: 'used_api_version',
  help: 'The used API version (x-api-version header)',
  labelNames: ['version'],
});
