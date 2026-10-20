import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { injectActiveTraceContext, withTraceContext } from './tracing';

const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

beforeAll(() => {
  provider.register();
});

afterAll(async () => {
  await provider.shutdown();
  trace.disable();
  context.disable();
  propagation.disable();
});

describe('trace context across a message boundary', () => {
  it('joins a span started with a transferred carrier to the sender trace', async () => {
    const tracer = trace.getTracer('test');
    const sender = tracer.startActiveSpan('main-thread', span => {
      const carrier = injectActiveTraceContext();
      span.end();
      return { carrier, spanContext: span.spanContext() };
    });

    await withTraceContext(structuredClone(sender.carrier), async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      tracer.startSpan('worker').end();
    });

    const worker = exporter.getFinishedSpans().find(span => span.name === 'worker');
    expect(worker?.spanContext().traceId).toBe(sender.spanContext.traceId);
    expect(worker?.parentSpanContext?.spanId).toBe(sender.spanContext.spanId);
  });

  it('starts a new trace when no carrier was transferred', async () => {
    const tracer = trace.getTracer('test');
    const outer = tracer.startActiveSpan('unrelated', span => {
      withTraceContext(undefined, () => tracer.startSpan('worker-without-carrier').end());
      span.end();
      return span.spanContext();
    });

    const worker = exporter.getFinishedSpans().find(span => span.name === 'worker-without-carrier');
    expect(worker?.spanContext().traceId).toBe(outer.traceId);
  });
});
