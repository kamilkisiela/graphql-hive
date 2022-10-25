import { createPool } from 'slonik';
import * as utils from '@n1ru4l/dockest/test-helper';
import { resetDb } from './testkit/db';
import { resetClickHouse } from './testkit/clickhouse';
import { resetRedis } from './testkit/redis';

const dbAddress = utils.getServiceAddress('db', 5432);
const redisAddress = utils.getServiceAddress('redis', 6379);

const pool = createPool(`postgresql://postgres:postgres@${dbAddress}/registry`);

beforeEach(async () => resetDb(await pool));
beforeEach(() => resetClickHouse());
beforeEach(() =>
  resetRedis({
    host: redisAddress.replace(':6379', ''),
    port: 6379,
    password: 'test',
  })
);
