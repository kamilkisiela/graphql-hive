import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../../shared/providers/http-client';
import { ClickHouse, sql } from './clickhouse-client';
import type { ClickHouseConfig } from './tokens';

const logger = {
  child: () => logger,
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;

function setup(database?: string) {
  const post = vi.fn().mockResolvedValue({ data: [], rows: 0, statistics: { elapsed: 0 } });
  const config: ClickHouseConfig = {
    protocol: 'http',
    host: 'localhost',
    port: 8123,
    username: 'test',
    password: 'test',
    database,
  };
  const clickhouse = new ClickHouse(config, { post } as unknown as HttpClient, logger);
  const searchParams = () => post.mock.calls[0][1].searchParams as Record<string, unknown>;
  return { clickhouse, searchParams };
}

// Queries name their tables unqualified, so the `database` request setting is the only thing
// that keeps a Hive instance on its own database when CLICKHOUSE_DB is set.
describe('ClickHouse database selection', () => {
  it('sends the configured database with a query', async () => {
    const { clickhouse, searchParams } = setup('hive');
    await clickhouse.query({ query: sql`SELECT 1`, queryId: 'test', timeout: 1000 });
    expect(searchParams().database).toBe('hive');
  });

  it('sends the configured database with a postQuery', async () => {
    const { clickhouse, searchParams } = setup('hive');
    await clickhouse.postQuery({ query: sql`SELECT 1`, queryId: 'test', timeout: 1000 });
    expect(searchParams().database).toBe('hive');
  });

  it('sends the configured database with an insert', async () => {
    const { clickhouse, searchParams } = setup('hive');
    await clickhouse.insert({
      query: sql`INSERT INTO audit_logs FORMAT CSV`,
      queryId: 'test',
      data: [[1]],
      timeout: 1000,
    });
    expect(searchParams().database).toBe('hive');
  });

  it('sends no database setting when none is configured', async () => {
    const { clickhouse, searchParams } = setup(undefined);
    await clickhouse.query({ query: sql`SELECT 1`, queryId: 'test', timeout: 1000 });
    expect(searchParams()).not.toHaveProperty('database');
  });

  it('keeps bound query values alongside the database setting', async () => {
    const { clickhouse, searchParams } = setup('hive');
    await clickhouse.query({
      query: sql`SELECT * FROM operations WHERE target = ${'abc'}`,
      queryId: 'test',
      timeout: 1000,
    });
    expect(searchParams()).toMatchObject({ database: 'hive', param_p1: 'abc' });
  });
});

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

const respondOk: RequestHandler = (req, res) => {
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
};

const hold: RequestHandler = req => {
  req.resume();
};

describe('ClickHouse insert', () => {
  let server: Server;
  let port: number;
  let handler: RequestHandler;
  let queryIds: Array<string | null>;
  let requests: Array<URLSearchParams>;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
      queryIds.push(params.get('query_id'));
      requests.push(params);
      handler(req, res);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  beforeEach(() => {
    queryIds = [];
    requests = [];
    handler = respondOk;
  });

  function createClient() {
    return new ClickHouse(
      {
        protocol: 'http',
        host: '127.0.0.1',
        port,
        database: 'test',
        username: 'test',
        password: 'test',
      },
      new HttpClient(),
      logger,
    );
  }

  const insertArgs = { query: sql`INSERT INTO t FORMAT CSV`, queryId: 'insert_test', data: [[1]] };

  it('sends a query id', async () => {
    await expect(createClient().insert(insertArgs)).resolves.toBeUndefined();
    expect(queryIds).toHaveLength(1);
    expect(queryIds[0]).toMatch(/^insert_test-[0-9a-f]+$/);
  });

  it('keeps the asynchronous insert by default', async () => {
    await expect(createClient().insert(insertArgs)).resolves.toBeUndefined();
    expect(requests[0].get('async_insert')).toBe('1');
    expect(requests[0].get('wait_for_async_insert')).toBe('1');
  });

  it('writes synchronously in sync mode', async () => {
    await expect(createClient().insert({ ...insertArgs, mode: 'sync' })).resolves.toBeUndefined();
    expect(requests[0].get('async_insert')).toBe('0');
    expect(requests[0].get('wait_for_async_insert')).toBeNull();
    expect(requests[0].get('query_id')).toMatch(/^insert_test-[0-9a-f]+$/);
  });

  it('retries a connection error with a suffixed query id', async () => {
    let first = true;
    handler = (req, res) => {
      if (first) {
        first = false;
        req.socket.destroy();
        return;
      }
      respondOk(req, res);
    };

    await expect(createClient().insert(insertArgs)).resolves.toBeUndefined();
    expect(queryIds).toHaveLength(2);
    expect(queryIds[1]).toBe(`${queryIds[0]}-r1`);
  });

  it('honours an explicit timeout when no signal is given', async () => {
    handler = hold;
    await expect(createClient().insert({ ...insertArgs, timeout: 50 })).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
    expect(queryIds).toHaveLength(1);
  });

  it('stops at the signal and does not re-send the batch', async () => {
    handler = hold;
    await expect(
      createClient().insert({ ...insertArgs, signal: AbortSignal.timeout(50) }),
    ).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    expect(queryIds).toHaveLength(1);
  });
});
