import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-node';
import { configureTracing } from './tracing';

const exported: Array<ReadableSpan> = [];
const exporter: SpanExporter = {
  export(spans, resultCallback) {
    exported.push(...spans);
    resultCallback({ code: 0 });
  },
  shutdown: () => Promise.resolve(),
};
const provider = new NodeTracerProvider({
  spanProcessors: [new BatchSpanProcessor(exporter, { scheduledDelayMillis: 60_000 })],
});

beforeAll(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  provider.register();
});

afterAll(() => {
  trace.disable();
  context.disable();
  propagation.disable();
  vi.restoreAllMocks();
});

describe('TracingInstance.shutdown', () => {
  it('exports the spans still buffered by the batch processor', async () => {
    trace.getTracer('test').startSpan('buffered').end();
    expect(exported).toHaveLength(0);

    await configureTracing({ serviceName: 'test' }).shutdown();

    expect(exported.map(span => span.name)).toEqual(['buffered']);
  });
});
