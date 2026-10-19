import { Injectable, Scope } from 'graphql-modules';
import { context, metrics, SpanKind, SpanStatusCode, trace } from '@hive/service-common';
import { AwsClient } from '../../cdn/providers/aws';
import { S3Config, S3Destination } from './s3-config';

export type S3WriteOperation =
  | 'app_deployment_enabled'
  | 'app_deployment_manifest'
  | 'artifact_latest'
  | 'artifact_versioned'
  | 'audit_log_export'
  | 'cdn_access_token'
  | 'debug_artifact'
  | 'persisted_document';

export type S3WriteMetric = {
  destination: string;
  operation: S3WriteOperation;
  statusCode: number | 'none';
  durationSeconds: number;
};

export type R2ErrorTrace = {
  rayId: string;
  statusCode: number;
};

export type R2ErrorTraceSummary = {
  rayIds: Array<string>;
  statusCodes: Array<number>;
  totalCount: number;
};

const s3Writes = new metrics.Counter({
  name: 'api_s3_writes_total',
  help: 'Number of S3-compatible object storage write attempts from the GraphQL API',
  labelNames: ['destination', 'operation', 'status_code'],
});

const s3WriteDuration = new metrics.Histogram({
  name: 'api_s3_write_duration_seconds',
  help: 'Latency of S3-compatible object storage write attempts from the GraphQL API',
  labelNames: ['destination', 'operation', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export function observeS3Write(metric: S3WriteMetric) {
  const labels = {
    destination: metric.destination,
    operation: metric.operation,
    status_code: metric.statusCode,
  };
  s3Writes.inc(labels);
  s3WriteDuration.observe(labels, metric.durationSeconds);
}

type S3RequestInit = Parameters<AwsClient['fetch']>[1];

const tracer = trace.getTracer('s3-writer');

@Injectable({ scope: Scope.Singleton, global: true })
export class S3Writer {
  constructor(
    private s3Config: S3Config,
    private observer: (metric: S3WriteMetric) => void = observeS3Write,
    private r2ErrorObserver: (errors: Array<R2ErrorTrace>) => void = errors =>
      observeR2ErrorTrace(summarizeR2ErrorTraces(errors)),
  ) {}

  private async writeS3Object(
    s3: S3Destination,
    key: string,
    operation: S3WriteOperation,
    init: Omit<Parameters<AwsClient['fetch']>[1], 'method'>,
  ) {
    const startedAt = process.hrtime.bigint();
    let statusCode: S3WriteMetric['statusCode'] = 'none';
    const hostname = new URL(s3.endpoint).hostname;
    // The signed URL carries the credentials, so the key is recorded instead of `url.full`.
    const span = tracer.startSpan(`S3 PUT ${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.request.method': 'PUT',
        'server.address': hostname,
        'hive.s3.bucket': s3.bucket,
        'hive.s3.key': key,
        'hive.s3.operation': operation,
      },
    });

    try {
      const response = await context.with(trace.setSpan(context.active(), span), () =>
        s3.client.fetch([s3.endpoint, s3.bucket, key].join('/'), {
          ...init,
          method: 'PUT',
        }),
      );
      const rayId = response.headers['cf-ray'];
      span.setAttributes({
        'http.response.status_code': response.statusCode,
        'http.request.resend_count': response.retryCount,
        ...(typeof rayId === 'string' ? { 'cloudflare.ray.id': rayId } : {}),
      });
      if (response.statusCode >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.statusCode}` });
        if (hostname.endsWith('.r2.cloudflarestorage.com') && typeof rayId === 'string') {
          this.r2ErrorObserver([{ rayId, statusCode: response.statusCode }]);
        }
      }
      statusCode = response.statusCode;
      return response;
    } catch (error) {
      if (error instanceof Error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.setAttributes({
          'error.type': error.name,
          ...('code' in error && typeof error.code === 'string'
            ? { 'error.code': error.code }
            : {}),
        });
      }
      throw error;
    } finally {
      span.end();
      this.observer({
        destination: s3.endpoint + '/' + s3.bucket,
        operation,
        statusCode,
        durationSeconds: Number(process.hrtime.bigint() - startedAt) / 1e9,
      });
    }
  }

  async write(key: string, operation: S3WriteOperation, init: Omit<S3RequestInit, 'method'>) {
    const responses = [];
    for (const destination of this.s3Config.destinations) {
      responses.push(await this.writeS3Object(destination, key, operation, init));
    }
    return responses;
  }

  /** Like `write`, but the mirror PUT does not wait for the primary PUT to finish. */
  writeConcurrently(key: string, operation: S3WriteOperation, init: Omit<S3RequestInit, 'method'>) {
    return Promise.all(
      this.s3Config.destinations.map(destination =>
        this.writeS3Object(destination, key, operation, init),
      ),
    );
  }

  writePrimary(key: string, operation: S3WriteOperation, init: Omit<S3RequestInit, 'method'>) {
    return this.writeS3Object(this.s3Config.destinations[0], key, operation, init);
  }

  async request(key: string, init: S3RequestInit) {
    const responses = [];
    for (const destination of this.s3Config.destinations) {
      responses.push(await destination.client.fetch(this.url(destination, key), init));
    }
    return responses;
  }

  primaryUrl(key: string) {
    return this.url(this.s3Config.destinations[0], key);
  }

  private url(destination: S3Destination, key: string) {
    return [destination.endpoint, destination.bucket, key].join('/');
  }
}

export function observeR2ErrorTrace(summary: R2ErrorTraceSummary) {
  if (summary.totalCount === 0) {
    return;
  }

  trace.getActiveSpan()?.addEvent('cloudflare.r2.error_responses', {
    'cloudflare.ray.ids': summary.rayIds,
    'http.response.status_codes': summary.statusCodes,
    'error.count': summary.totalCount,
    'error.truncated_count': Math.max(0, summary.totalCount - summary.rayIds.length),
  });
}

export function summarizeR2ErrorTraces(errors: Array<R2ErrorTrace>): R2ErrorTraceSummary {
  const slicedErrors = errors.slice(0, 10);
  return {
    rayIds: slicedErrors.map(err => err.rayId),
    statusCodes: slicedErrors.map(err => err.statusCode),
    totalCount: errors.length,
  };
}
