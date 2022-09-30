import * as utils from 'dockest/test-helper';
import { fetch } from '@whatwg-node/fetch';

const clickhouseAddress = utils.getServiceAddress('clickhouse', 8123);
const endpoint = `http://${clickhouseAddress}/?default_format=JSON`;

export async function resetClickHouse() {
  const queries = [
    'operation_collection',
    'operations',
    'operations_hourly',
    'operations_daily',
    'coordinates_daily',
    'clients_daily',
    // legacy
    `operations_registry`,
    `operations_new_hourly_mv`,
    `operations_new`,
    `schema_coordinates_daily`,
    `client_names_daily`,
  ].map(table => `TRUNCATE TABLE default.${table}`);

  for await (const query of queries) {
    await fetch(endpoint, {
      method: 'POST',
      body: query,
      headers: {
        'Accept-Encoding': 'gzip',
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from('test:test').toString('base64')}`,
      },
    });
  }
}

export async function clickHouseQuery<T>(query: string): Promise<{
  data: T[];
  rows: number;
}> {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: query,
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      Authorization: `Basic ${Buffer.from('test:test').toString('base64')}`,
    },
  });

  return response.json();
}
